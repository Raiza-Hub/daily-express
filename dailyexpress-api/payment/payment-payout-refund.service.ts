import { getEmailSubject, renderEmail } from "@repo/email";
import { and, eq, gt, sql } from "drizzle-orm";
import { getConfig } from "../config/index";
import { db } from "../db/connection";
import { booking, earning, payment, refund, trip, users } from "../db/index";
import { logger } from "../utils/logger";
import { enqueueEmail, type EmailToSend } from "../mail/email-dispatcher.service";
import { koraClient, KoraClient } from "./kora.client";
import { PaymentRepository, paymentRepository } from "./payment.repository";
import type { PaymentRecord, BookingRecord, RefundRecord } from "../db/index";
import type { KoraBank, PaymentTransaction } from "./payment.types";
import bankNames from "./bank-name.json";

interface BanksCache {
  timestamp: number;
  banks: KoraBank[];
}

export class PaymentPayoutRefundService {
  private readonly config = getConfig();
  private banksCache: BanksCache | null = null;
  private readonly BANKS_CACHE_TTL_MS = 86_400_000;

  constructor(
    private repo: PaymentRepository,
    private kora: KoraClient,
  ) {}

  private async getBankCode(bankName: string): Promise<string | null> {
    const normalized = bankName.toLowerCase().replace(/\s+/g, "");

    try {
      if (
        !this.banksCache ||
        Date.now() - this.banksCache.timestamp > this.BANKS_CACHE_TTL_MS
      ) {
        const response = await this.kora.listBanks("NG");
        this.banksCache = { timestamp: Date.now(), banks: response.data };
      }

      for (const bank of this.banksCache.banks) {
        const candidate = bank.name.toLowerCase().replace(/\s+/g, "");
        if (candidate.includes(normalized) || normalized.includes(candidate)) {
          return bank.code;
        }
      }
    } catch (error) {
      logger.warn("payout_refund.list_banks_failed_falling_back", {
        bankName,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    for (const entry of bankNames) {
      const candidate = entry.bank_name.toLowerCase().replace(/\s+/g, "");
      if (candidate.includes(normalized) || normalized.includes(candidate)) {
        logger.info("payout_refund.bank_names_match", { bankName, matchedName: entry.bank_name, code: entry.code });
        return entry.code;
      }
    }

    return null;
  }

  async refundConfirmedBooking(
    paymentRecord: PaymentRecord,
    existingRefundReference: string,
    reason = "Trip cancelled because driver deactivated their account",
    emailReason?: "driver_deactivated" | "no_driver_found" | "admin_cancelled",
  ): Promise<void> {
    if (paymentRecord.status !== "successful") return;

    if (
      !paymentRecord.payerBankName ||
      !paymentRecord.payerAccountNumber ||
      !paymentRecord.payerAccountName
    ) {
      logger.error("payout_refund.missing_payer_details", {
        reference: paymentRecord.reference,
      });
      return;
    }

    const bankCode = await this.getBankCode(paymentRecord.payerBankName);
    if (!bankCode) {
      logger.error("payout_refund.bank_code_not_found", {
        reference: paymentRecord.reference,
        bankName: paymentRecord.payerBankName,
      });
      return;
    }

    if (!paymentRecord.bookingId) {
      logger.error("payout_refund.missing_booking_id", { reference: paymentRecord.reference });
      return;
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, paymentRecord.bookingId),
      columns: { totalAmount: true },
    });
    if (!bookingRecord) {
      logger.error("payout_refund.booking_not_found", { reference: paymentRecord.reference, bookingId: paymentRecord.bookingId });
      return;
    }
    const refundAmount = bookingRecord.totalAmount;

    let pendingRefund: RefundRecord | null = null;

    if (existingRefundReference) {
      pendingRefund = (await this.repo.findRefundByReference(existingRefundReference)) ?? null;
    }

    if (!pendingRefund) {
      pendingRefund = await db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(payment)
          .where(eq(payment.id, paymentRecord.id))
          .for("update")
          .limit(1);

        if (!locked || locked.status !== "successful") return null;

        const existing = await tx.query.refund.findFirst({
          where: and(
            eq(refund.paymentId, locked.id),
            eq(refund.status, "pending"),
          ),
        });
        if (existing) return existing;

        const [row] = await this.repo.insertRefund(tx, {
          paymentId: paymentRecord.id,
          bookingId: paymentRecord.bookingId,
          reference: existingRefundReference,
          amount: refundAmount,
          currency: paymentRecord.currency,
          status: "pending",
        });
        return row;
      });
    }

    if (!pendingRefund) return;

    const resolvedRefund: RefundRecord = pendingRefund;

    if (paymentRecord.bookingId) {
      const bookingId = paymentRecord.bookingId;
      await db.transaction(async (tx) => {
        const bookingRecord = await tx.query.booking.findFirst({
          where: eq(booking.id, bookingId),
        });
        if (!bookingRecord) return;

        await tx
          .update(booking)
          .set({ paymentStatus: "refund_pending", updatedAt: new Date() })
          .where(eq(booking.id, bookingId));

        if (bookingRecord.status === "confirmed" && bookingRecord.tripId) {
          const passengerCount = await this.repo.countPassengersByBooking(
            tx,
            bookingRecord.id,
          );
          await tx
            .update(trip)
            .set({ bookedSeats: sql`GREATEST(${trip.bookedSeats} - ${passengerCount}, 0)` })
            .where(
              and(eq(trip.id, bookingRecord.tripId), gt(trip.bookedSeats, 0)),
            );
        }

        if (bookingRecord.tripId) {
          await tx
            .update(earning)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(earning.tripId, bookingRecord.tripId));
        }
      });
    }

    let accountNumber: string;
    let accountName: string;
    try {
      const resolvedAccount = await this.kora.resolveAccountNumber(
        bankCode,
        paymentRecord.payerAccountNumber,
        paymentRecord.currency,
      );
      accountNumber = resolvedAccount.data.account_number;
      accountName = resolvedAccount.data.account_name;
    } catch (error) {
      logger.warn("payout_refund.account_resolve_failed_proceeding", {
        reference: paymentRecord.reference,
        error: error instanceof Error ? error.message : String(error),
      });
      accountNumber = paymentRecord.payerAccountNumber;
      accountName = paymentRecord.payerAccountName;
    }

    const payoutRef = `REF-${paymentRecord.reference}`;
    try {
      await this.kora.initiatePayout({
        reference: payoutRef,
        amount: refundAmount,
        currency: paymentRecord.currency,
        bankCode,
        accountNumber,
        accountName,
        customerEmail: paymentRecord.customerEmail ?? "",
        narration: reason,
      });
    } catch (error) {
      const found = await this.kora.findPayoutByReference(payoutRef);

      switch (found?.status) {
        case "success":
          await this.finalizeRefund(paymentRecord.reference, "refunded");
          return;
        case "pending":
        case "processing":
        case "failed":
          logger.info("payout_refund.provider_owns_transfer", {
            reference: paymentRecord.reference,
            status: found.status,
          });
          return;
        default:
          throw error;
      }
    }

    await db.transaction(async (tx) => {
      const email = await this.sendTripCancelledEmail(
        paymentRecord,
        resolvedRefund.reference,
        emailReason,
        refundAmount,
        tx,
      );
      if (email) {
        await enqueueEmail(tx, email);
      }
    });
  }

  async finalizeRefund(
    paymentReference: string,
    status: "refunded" | "refund_failed",
  ) {
    const existingPayment = await this.repo.findPaymentByReference(
      paymentReference,
    );
    if (!existingPayment) return;

    await db.transaction(async (tx) => {
      const [lockedPayment] = await tx
        .select()
        .from(payment)
        .where(eq(payment.reference, paymentReference))
        .for("update")
        .limit(1);
      if (!lockedPayment) return;

      const pendingRefund = await tx.query.refund.findFirst({
        where: and(
          eq(refund.paymentId, lockedPayment.id),
          eq(refund.status, "pending"),
        ),
        orderBy: (ref, { desc }) => [desc(ref.createdAt)],
      });
      if (!pendingRefund) {
        logger.info("payout_refund.webhook_already_processed", {
          paymentReference,
        });
        return;
      }

      await this.repo.updateRefundStatus(tx, pendingRefund.id, {
        status: status === "refunded" ? "successful" : "failed",
        completedAt: new Date(),
      });

      if (status === "refunded" && existingPayment.customerEmail) {
        const email = await this.sendRefundSuccessEmail(
          existingPayment,
          pendingRefund.amount,
          existingPayment.productName ?? "your trip",
          tx,
        );
        if (email) {
          await enqueueEmail(tx, email);
        }
      }

      await tx
        .update(booking)
        .set({ paymentStatus: status, updatedAt: new Date() })
        .where(eq(booking.paymentReference, paymentReference));
    });
  }

  async sendRefundFailureEmail(
    paymentRecord: PaymentRecord,
    failureReason: string,
    refundAmount: number,
    tx: PaymentTransaction,
  ): Promise<EmailToSend | null> {
    if (!paymentRecord.customerEmail) return null;

    let customerName: string | null = null;
    if (paymentRecord.bookingId) {
      const bookingRef = await tx.query.booking.findFirst({
        where: eq(booking.id, paymentRecord.bookingId),
        columns: { userId: true },
      });
      if (bookingRef?.userId) {
        const userName = await tx.query.users.findFirst({
          where: eq(users.id, bookingRef.userId),
          columns: { firstName: true, lastName: true },
        });
        if (userName?.firstName) {
          customerName = `${userName.firstName} ${userName.lastName ?? ""}`.trim();
        }
      }
    }

    const propsJson = JSON.stringify({
      frontendUrl: this.config.FRONTEND_URL,
      customerName,
      customerEmail: paymentRecord.customerEmail,
      paymentReference: paymentRecord.reference,
      bookingId: paymentRecord.bookingId,
      amount: refundAmount,
      currency: paymentRecord.currency,
      productName: paymentRecord.productName,
      failureReason,
      supportEmail: "support@dailyexpress.app",
      supportPhone: this.config.SUPPORT_PHONE,
    });
    const html = await renderEmail("RefundFailedEmail", propsJson);
    const subject = getEmailSubject("RefundFailedEmail", propsJson);

    return {
      emailName: "email.refund_failed",
      to: paymentRecord.customerEmail,
      subject,
      html,
    };
  }

  async sendTripCancelledEmail(
    paymentRecord: PaymentRecord,
    refundReference: string,
    reason: "driver_deactivated" | "no_driver_found" | "admin_cancelled" | undefined,
    refundAmount: number,
    tx: PaymentTransaction,
  ): Promise<EmailToSend | null> {
    if (!paymentRecord.customerEmail) return null;

    const amount = refundAmount;

    let customerName: string | null = null;
    if (paymentRecord.bookingId) {
      const bookingRef = await tx.query.booking.findFirst({
        where: eq(booking.id, paymentRecord.bookingId),
        columns: { userId: true },
      });
      if (bookingRef?.userId) {
        const userName = await tx.query.users.findFirst({
          where: eq(users.id, bookingRef.userId),
          columns: { firstName: true, lastName: true },
        });
        if (userName?.firstName) {
          customerName = `${userName.firstName} ${userName.lastName ?? ""}`.trim();
        }
      }
    }

    const propsJson = JSON.stringify({
      frontendUrl: this.config.FRONTEND_URL,
      customerName,
      customerEmail: paymentRecord.customerEmail,
      paymentReference: paymentRecord.reference,
      productName: paymentRecord.productName,
      amount,
      currency: paymentRecord.currency,
      refundReference,
      reason,
      supportEmail: "support@dailyexpress.app",
      supportPhone: this.config.SUPPORT_PHONE,
    });
    const html = await renderEmail("TripCancelledEmail", propsJson);
    const subject = getEmailSubject("TripCancelledEmail", propsJson);

    return {
      emailName: "email.trip_cancelled_refund",
      to: paymentRecord.customerEmail,
      subject,
      html,
    };
  }

  async sendRefundSuccessEmail(
    paymentRecord: PaymentRecord,
    refundAmount: number,
    productName: string,
    tx: PaymentTransaction,
  ): Promise<EmailToSend | null> {
    if (!paymentRecord.customerEmail) return null;

    const amount = refundAmount;

    let customerName: string | null = null;
    if (paymentRecord.bookingId) {
      const bookingRef = await tx.query.booking.findFirst({
        where: eq(booking.id, paymentRecord.bookingId),
        columns: { userId: true },
      });
      if (bookingRef?.userId) {
        const userName = await tx.query.users.findFirst({
          where: eq(users.id, bookingRef.userId),
          columns: { firstName: true, lastName: true },
        });
        if (userName?.firstName) {
          customerName = `${userName.firstName} ${userName.lastName ?? ""}`.trim();
        }
      }
    }

    const propsJson = JSON.stringify({
      frontendUrl: this.config.FRONTEND_URL,
      customerName,
      customerEmail: paymentRecord.customerEmail,
      paymentReference: paymentRecord.reference,
      bookingId: paymentRecord.bookingId,
      amount,
      currency: paymentRecord.currency,
      productName,
      supportEmail: "support@dailyexpress.app",
      supportPhone: this.config.SUPPORT_PHONE,
    });
    const html = await renderEmail("RefundSuccessfulEmail", propsJson);
    const subject = getEmailSubject("RefundSuccessfulEmail", propsJson);

    return {
      emailName: "email.refund_successful",
      to: paymentRecord.customerEmail,
      subject,
      html,
    };
  }
}

export const paymentPayoutRefundService = new PaymentPayoutRefundService(
  paymentRepository,
  koraClient,
);
