import { getEmailSubject, renderEmail } from "@repo/email";
import { and, eq, gt, sql } from "drizzle-orm";
import { getConfig } from "../config/index";
import { db } from "../db/connection";
import { booking, earning, payment, refund, trip } from "../db/index";
import { driverService as sharedDriverService } from "../driver/driver.service";
import { logger } from "../utils/logger";
import { generateReference, toMinorAmount } from "../utils/payment";
import { jobService } from "../workers/job.service";
import { koraClient, KoraClient } from "./kora.client";
import { PaymentRepository, paymentRepository } from "./payment.repository";
import type { PaymentRecord, BookingRecord, RefundRecord } from "../db/index";
import { enrichWithExpiry } from "./payment.utils";
import type { KoraBank, KoraVerifyResponse, PaymentTransaction } from "./payment.types";
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

  async refundPayment(
    reference: string,
    verification: Pick<
      KoraVerifyResponse,
      "amount" | "currency" | "paid_at" | "payment_reference" | "reference" | "status"
    >,
    rawVerificationResponse: unknown,
    reason = "Seat reservation expired before payment was completed",
  ) {
    const existingPayment = await this.repo.findPaymentByReference(reference);
    if (!existingPayment || existingPayment.status !== "expired") {
      return existingPayment ? enrichWithExpiry(existingPayment) : null;
    }

    if (
      !existingPayment.payerBankName ||
      !existingPayment.payerAccountNumber ||
      !existingPayment.payerAccountName
    ) {
      logger.error("payout_refund.missing_payer_details", { reference });
      return enrichWithExpiry(existingPayment);
    }

    const bankCode = await this.getBankCode(existingPayment.payerBankName);
    if (!bankCode) {
      logger.error("payout_refund.bank_code_not_found", {
        reference,
        bankName: existingPayment.payerBankName,
      });
      return enrichWithExpiry(existingPayment);
    }

    if (!existingPayment.bookingId) {
      logger.error("payout_refund.missing_booking_id", { reference });
      return enrichWithExpiry(existingPayment);
    }

    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, existingPayment.bookingId),
      columns: { fareAmount: true, feeAmount: true },
    });
    if (!bookingRecord) {
      logger.error("payout_refund.booking_not_found", { reference, bookingId: existingPayment.bookingId });
      return enrichWithExpiry(existingPayment);
    }
    const refundAmount = bookingRecord.fareAmount;

    const pendingRefund = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(payment)
        .where(eq(payment.id, existingPayment.id))
        .for("update")
        .limit(1);

      if (!locked || locked.status !== "expired") return null as RefundRecord | null;

      const existing = await tx.query.refund.findFirst({
        where: and(
          eq(refund.paymentId, locked.id),
          eq(refund.status, "pending"),
        ),
        orderBy: (ref, { desc }) => [desc(ref.createdAt)],
      });
      if (existing) return existing;

      const [row] = await this.repo.insertRefund(tx, {
        paymentId: existingPayment.id,
        bookingId: existingPayment.bookingId,
        reference: generateReference(),
        amount: refundAmount,
        currency: existingPayment.currency,
        reason,
        status: "pending",
        initiatedBy: "auto",
      });
      return row;
    });

    if (!pendingRefund) {
      return existingPayment ? enrichWithExpiry(existingPayment) : null;
    }

    let accountNumber: string;
    let accountName: string;
    try {
      const resolvedAccount = await this.kora.resolveAccountNumber(
        bankCode,
        existingPayment.payerAccountNumber,
        existingPayment.currency,
      );
      accountNumber = resolvedAccount.data.account_number;
      accountName = resolvedAccount.data.account_name;
    } catch (error) {
      logger.warn("payout_refund.account_resolve_failed_proceeding", {
        reference,
        error: error instanceof Error ? error.message : String(error),
      });
      accountNumber = existingPayment.payerAccountNumber;
      accountName = existingPayment.payerAccountName;
    }

    const payoutRef = `REF-${reference}`;
    try {
      await this.kora.initiatePayout({
        reference: payoutRef,
        amount: refundAmount,
        currency: verification.currency,
        bankCode,
        accountNumber,
        accountName,
        customerEmail: existingPayment.customerEmail ?? "",
        narration: reason,
      });
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : String(error);
      await db.transaction(async (tx) => {
        await this.repo.updateRefundStatus(tx, pendingRefund.id, {
          status: "failed",
          failureReason,
          completedAt: new Date(),
        });
        await this.sendRefundFailureEmail(
          existingPayment,
          failureReason,
          refundAmount,
          tx,
        );
      });
      return;
    }

    await db.transaction(async (tx) => {
      await this.repo.updateRefundStatus(tx, pendingRefund.id, {
        status: "successful",
        providerRefundReference: payoutRef,
        providerStatus: "processing",
        completedAt: new Date(),
      });

      if (!existingPayment.bookingId) return;

      const bookingResult = await this.repo.updateBookingPaymentStatus(tx, {
        bookingId: existingPayment.bookingId,
        paymentReference: reference,
        paymentStatus: "expired",
      });

      const earningRecord = await tx.query.earning.findFirst({
        where: eq(earning.bookingId, existingPayment.bookingId),
      });

      await tx
        .update(earning)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(earning.bookingId, existingPayment.bookingId));

      if (bookingResult.cancelledConfirmed && bookingResult.booking) {
        await this.resolveAndCancelBookingStats(
          tx,
          bookingResult.booking,
          earningRecord,
        );
      } else if (earningRecord) {
        await sharedDriverService.adjustPaymentCountersForStatusChange(tx, {
          driverId: earningRecord.driverId,
          amountMinor: earningRecord.netAmountMinor,
          previousStatus: earningRecord.status,
          nextStatus: "cancelled",
        });
      }
    });

    logger.info("payment.payout_refund_initiated", {
      reference,
      amount: existingPayment.amount,
      payoutRef,
    });

    return enrichWithExpiry(existingPayment);
  }

  async refundConfirmedBooking(
    paymentRecord: PaymentRecord,
    reason = "Trip cancelled because driver deactivated their account",
    emailReason?: "driver_deactivated" | "no_driver_found" | "admin_cancelled",
    existingRefundReference?: string,
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
      columns: { fareAmount: true, feeAmount: true },
    });
    if (!bookingRecord) {
      logger.error("payout_refund.booking_not_found", { reference: paymentRecord.reference, bookingId: paymentRecord.bookingId });
      return;
    }
    const refundAmount = bookingRecord.fareAmount;

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
          reference: generateReference(),
          amount: refundAmount,
          currency: paymentRecord.currency,
          reason,
          status: "pending",
          initiatedBy: "auto",
        });
        return row;
      });
    }

    if (!pendingRefund) return;

    const resolvedRefund: RefundRecord = pendingRefund;
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
      await db.transaction(async (tx) => {
        await this.repo.updateRefundStatus(tx, resolvedRefund.id, {
          status: "failed",
          failureReason: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        });
      });
      throw error;
    }

    await db.transaction(async (tx) => {
      await this.repo.updateRefundStatus(tx, resolvedRefund.id, {
        status: "successful",
        providerRefundReference: payoutRef,
        providerStatus: "processing",
        completedAt: new Date(),
      });

      if (paymentRecord.bookingId) {
        const bookingRecord = await tx.query.booking.findFirst({
          where: eq(booking.id, paymentRecord.bookingId),
        });

        if (bookingRecord) {
          const wasConfirmed = bookingRecord.status === "confirmed";

          await tx
            .update(booking)
            .set({
              paymentStatus: "refund_pending",
              seatNumber: null,
              updatedAt: new Date(),
            })
            .where(eq(booking.id, paymentRecord.bookingId));

          if (wasConfirmed && bookingRecord.tripId) {
            await tx
              .update(trip)
              .set({ bookedSeats: sql`GREATEST(${trip.bookedSeats} - 1, 0)` })
              .where(
                and(eq(trip.id, bookingRecord.tripId), gt(trip.bookedSeats, 0)),
              );
          }

          const earningRecord = await tx.query.earning.findFirst({
            where: eq(earning.bookingId, paymentRecord.bookingId),
          });

          await tx
            .update(earning)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(earning.bookingId, paymentRecord.bookingId));

          if (wasConfirmed) {
            await this.resolveAndCancelBookingStats(
              tx,
              bookingRecord,
              earningRecord,
            );
          } else if (earningRecord) {
            await sharedDriverService.adjustPaymentCountersForStatusChange(tx, {
              driverId: earningRecord.driverId,
              amountMinor: earningRecord.netAmountMinor,
              previousStatus: earningRecord.status,
              nextStatus: "cancelled",
            });
          }
        }
      }

      await this.sendTripCancelledEmail(
        paymentRecord,
        resolvedRefund.reference,
        emailReason,
        refundAmount,
        tx,
      );
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
        await this.sendRefundSuccessEmail(
          existingPayment,
          pendingRefund.amount,
          pendingRefund.reference,
          existingPayment.productName ?? "your trip",
          tx,
        );
      }

      const [bookingRecord] = await tx
        .update(booking)
        .set({ paymentStatus: status, updatedAt: new Date() })
        .where(eq(booking.paymentReference, paymentReference))
        .returning();

      if (
        bookingRecord &&
        bookingRecord.status === "confirmed" &&
        bookingRecord.seatNumber !== null
      ) {
        const earningRecord = await tx.query.earning.findFirst({
          where: eq(earning.bookingId, bookingRecord.id),
        });

        await tx
          .update(earning)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(earning.bookingId, bookingRecord.id));

        if (status === "refunded") {
          await this.resolveAndCancelBookingStats(
            tx,
            bookingRecord,
            earningRecord,
          );
        } else if (earningRecord) {
          await sharedDriverService.adjustPaymentCountersForStatusChange(tx, {
            driverId: earningRecord.driverId,
            amountMinor: earningRecord.netAmountMinor,
            previousStatus: earningRecord.status,
            nextStatus: "cancelled",
          });
        }

        if (bookingRecord.tripId) {
          await tx
            .update(trip)
            .set({ bookedSeats: sql`GREATEST(${trip.bookedSeats} - 1, 0)` })
            .where(eq(trip.id, bookingRecord.tripId));
        }
      }
    });
  }

  async sendRefundFailureEmail(
    paymentRecord: PaymentRecord,
    failureReason: string,
    refundAmount: number,
    tx: PaymentTransaction,
  ) {
    if (!paymentRecord.customerEmail) return;

    let customerName: string | null = null;
    if (paymentRecord.bookingId) {
      const bk = await tx.query.booking.findFirst({
        where: eq(booking.id, paymentRecord.bookingId),
        columns: { firstName: true, lastName: true },
      });
      if (bk?.firstName) {
        customerName = `${bk.firstName} ${bk.lastName ?? ""}`.trim();
      }
    }

    const propsJson = JSON.stringify({
      frontendUrl: this.config.FRONTEND_URL,
      customerName,
      customerEmail: paymentRecord.customerEmail,
      paymentReference: paymentRecord.reference,
      bookingId: paymentRecord.bookingId,
      amountMinor: toMinorAmount(refundAmount),
      currency: paymentRecord.currency,
      productName: paymentRecord.productName,
      failureReason,
      supportEmail: "support@dailyexpress.app",
      supportPhone: this.config.SUPPORT_PHONE,
    });
    const html = await renderEmail("RefundFailedEmail", propsJson);
    const subject = getEmailSubject("RefundFailedEmail", propsJson);

    await jobService.enqueueEmail(tx, "email.refund_failed", {
      to: paymentRecord.customerEmail,
      subject,
      html,
    });
  }

  async sendTripCancelledEmail(
    paymentRecord: PaymentRecord,
    refundReference: string,
    reason: "driver_deactivated" | "no_driver_found" | "admin_cancelled" | undefined,
    refundAmount: number,
    tx: PaymentTransaction,
  ) {
    if (!paymentRecord.customerEmail) return;

    const amountMinor = toMinorAmount(refundAmount);

    let customerName: string | null = null;
    if (paymentRecord.bookingId) {
      const bk = await tx.query.booking.findFirst({
        where: eq(booking.id, paymentRecord.bookingId),
        columns: { firstName: true, lastName: true },
      });
      if (bk?.firstName) {
        customerName = `${bk.firstName} ${bk.lastName ?? ""}`.trim();
      }
    }

    const propsJson = JSON.stringify({
      frontendUrl: this.config.FRONTEND_URL,
      customerName,
      customerEmail: paymentRecord.customerEmail,
      paymentReference: paymentRecord.reference,
      productName: paymentRecord.productName,
      amountMinor,
      currency: paymentRecord.currency,
      refundReference,
      reason,
      supportEmail: "support@dailyexpress.app",
      supportPhone: this.config.SUPPORT_PHONE,
    });
    const html = await renderEmail("TripCancelledEmail", propsJson);
    const subject = getEmailSubject("TripCancelledEmail", propsJson);

    await jobService.enqueueEmail(tx, "email.trip_cancelled_refund", {
      to: paymentRecord.customerEmail,
      subject,
      html,
    });
  }

  async sendRefundSuccessEmail(
    paymentRecord: PaymentRecord,
    refundAmount: number,
    refundReference: string,
    productName: string,
    tx: PaymentTransaction,
  ) {
    if (!paymentRecord.customerEmail) return;

    const amountMinor = toMinorAmount(refundAmount);

    let customerName: string | null = null;
    if (paymentRecord.bookingId) {
      const bk = await tx.query.booking.findFirst({
        where: eq(booking.id, paymentRecord.bookingId),
        columns: { firstName: true, lastName: true },
      });
      if (bk?.firstName) {
        customerName = `${bk.firstName} ${bk.lastName ?? ""}`.trim();
      }
    }

    const propsJson = JSON.stringify({
      frontendUrl: this.config.FRONTEND_URL,
      customerName,
      customerEmail: paymentRecord.customerEmail,
      paymentReference: paymentRecord.reference,
      bookingId: paymentRecord.bookingId,
      amountMinor,
      currency: paymentRecord.currency,
      productName,
      supportEmail: "support@dailyexpress.app",
      supportPhone: this.config.SUPPORT_PHONE,
    });
    const html = await renderEmail("RefundSuccessfulEmail", propsJson);
    const subject = getEmailSubject("RefundSuccessfulEmail", propsJson);

    await jobService.enqueueEmail(tx, "email.refund_successful", {
      to: paymentRecord.customerEmail,
      subject,
      html,
    });
  }

  private async resolveAndCancelBookingStats(
    tx: PaymentTransaction,
    bookingRecord: BookingRecord,
    existingEarning?: typeof earning.$inferSelect | null,
  ) {
    const earningRecord =
      existingEarning ??
      (await tx.query.earning.findFirst({
        where: eq(earning.bookingId, bookingRecord.id),
      }));
    const driverId =
      earningRecord?.driverId ??
      (bookingRecord.tripId
        ? (
            await tx.query.trip.findFirst({
              where: eq(trip.id, bookingRecord.tripId),
              columns: { driverId: true },
            })
          )?.driverId
        : undefined);

    if (!driverId) return;

    await sharedDriverService.decrementStatsForCancelledBooking(tx, {
      driverId,
      amountMinor:
        earningRecord?.netAmountMinor ?? toMinorAmount(bookingRecord.fareAmount),
      previousEarningStatus: earningRecord?.status ?? null,
    });
  }
}

export const paymentPayoutRefundService = new PaymentPayoutRefundService(
  paymentRepository,
  koraClient,
);
