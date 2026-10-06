import { getEmailSubject, renderEmail } from "@repo/email";
import { eq } from "drizzle-orm";
import { getConfig } from "../config/index";
import { db } from "../db/connection";
import { booking, payment, users } from "../db/index";
import { logger } from "../utils/logger";
import { generateReference } from "../utils/payment";
import { enqueueEmail, type EmailToSend } from "../mail/email-dispatcher.service";
import { koraClient, KoraClient } from "./kora.client";
import { PaymentRepository, paymentRepository } from "./payment.repository";
import type { PaymentRecord, RefundRecord } from "../db/index";
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
    reason = "Trip cancelled because driver deactivated their account",
    emailReason?: "driver_deactivated" | "no_driver_found",
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
      throw new Error("Payer details are not available for the refund yet");
    }

    const bankCode = await this.getBankCode(paymentRecord.payerBankName);
    if (!bankCode) {
      logger.error("payout_refund.bank_code_not_found", {
        reference: paymentRecord.reference,
        bankName: paymentRecord.payerBankName,
      });
      throw new Error("Payer bank code could not be resolved for the refund");
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

    const refundRow = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(payment)
        .where(eq(payment.id, paymentRecord.id))
        .for("update")
        .limit(1);

      if (!locked || locked.status !== "successful") return null;

      const existing = await this.repo.findPendingRefundByPaymentId(tx, locked.id);
      if (existing) return { refund: existing, created: false };

      const reference = `REF-${generateReference()}`;

      const [created] = await this.repo.insertRefund(tx, {
        paymentId: locked.id,
        reference,
        amount: refundAmount,
        currency: locked.currency,
        status: "pending",
      });
      if (!created) return null;

      await this.repo.pointPaymentAtRefund(tx, locked.id, created.id);
      return { refund: created, created: true };
    });

    if (!refundRow) return;
    const { refund: refundRecord, created } = refundRow;

    if (!created) {
      const resolved = await this.reconcileExistingRefund(refundRecord);
      if (resolved) return;
      logger.info("payout_refund.awaiting_webhook", {
        reference: refundRecord.reference,
      });
      return;
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

    try {
      await this.kora.initiatePayout({
        reference: refundRecord.reference,
        amount: refundRecord.amount,
        currency: refundRecord.currency,
        bankCode,
        accountNumber,
        accountName,
        customerEmail: paymentRecord.customerEmail ?? "",
        narration: reason,
      });
    } catch (error) {
      const found = await this.kora.findPayoutByReference(refundRecord.reference);

      switch (found?.status) {
        case "success":
          await this.finalizeRefund(refundRecord.id, "successful");
          return;
        case "failed":
          await this.finalizeRefund(refundRecord.id, "failed");
          return;
        case "pending":
        case "processing":
          logger.info("payout_refund.provider_owns_transfer", {
            reference: refundRecord.reference,
            status: found.status,
          });
          return;
        default:
          logger.warn("payout_refund.initiate_failed_unresolved", {
            reference: refundRecord.reference,
            error: error instanceof Error ? error.message : String(error),
          });
          return;
      }
    }

    await db.transaction(async (tx) => {
      const email = await this.sendTripCancelledEmail(
        paymentRecord,
        refundRecord.reference,
        emailReason,
        refundRecord.amount,
        tx,
      );
      if (email) {
        await enqueueEmail(tx, email);
      }
    });
  }
  private async reconcileExistingRefund(refundRecord: RefundRecord) {
    const found = await this.kora.findPayoutByReference(refundRecord.reference);
    if (found?.status === "success") {
      await this.finalizeRefund(refundRecord.id, "successful");
      return true;
    }
    if (found?.status === "failed") {
      await this.finalizeRefund(refundRecord.id, "failed");
      return true;
    }
    return false;
  }
  async finalizeRefund(
    refundId: string,
    status: "successful" | "failed",
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const settled = await this.repo.settleRefund(tx, refundId, status);
      const [refundRecord] = settled;
      if (!refundRecord) {
        logger.info("payout_refund.webhook_already_processed", { refundId });
        return;
      }

      if (status !== "successful") return;

      const [paymentRecord] = await tx
        .select()
        .from(payment)
        .where(eq(payment.id, refundRecord.paymentId))
        .limit(1);
      if (!paymentRecord?.customerEmail) return;

      const email = await this.sendRefundSuccessEmail(
        paymentRecord,
        refundRecord.amount,
        paymentRecord.productName ?? "your trip",
        tx,
      );
      if (email) {
        await enqueueEmail(tx, email);
      }
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
    reason: "driver_deactivated" | "no_driver_found" | undefined,
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
