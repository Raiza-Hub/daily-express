import { and, eq } from "drizzle-orm";
import { createServiceError } from "@shared/utils";
import { logger } from "../utils/logger";
import { db } from "../db/connection";
import { booking, payment } from "../db/index";
import { getConfig } from "../config/index";
import { PaymentRepository } from "./payment.repository";
import { enrichWithExpiry } from "./payment.utils";
import { PaymentInitService } from "./payment-init.service";
import { PaymentConfirmService } from "./payment-confirm.service";
import { PaymentRefundService } from "./payment-refund.service";
import { PaymentWebhookService } from "./payment-webhook.service";
import { PaymentExpiryService } from "./payment-expiry.service";
import { PayoutService } from "../payout/payoutService";
import { KoraClient } from "./kora.client";
import type {
  InitializePaymentInput,
  KoraWebhookPayload,
  PaymentStatus,
} from "./payment.types";
import type { WebhookJobData } from "../workers/boss";

type PaymentRecord = typeof payment.$inferSelect;

const TERMINAL_PAYMENT_STATUSES = [
  "successful",
  "failed",
  "cancelled",
  "expired",
  "refund_pending",
  "refunded",
  "refund_failed",
] as const;

const payoutService = new PayoutService();

export class PaymentService {
  private readonly config = getConfig();
  private readonly repo = new PaymentRepository();
  private readonly confirmService = new PaymentConfirmService(this.repo, payoutService);
  private readonly refundService = new PaymentRefundService(this.repo);
  private readonly webhookService = new PaymentWebhookService(this.repo, this.confirmService, this.refundService);
  private readonly expiryService = new PaymentExpiryService(this.repo, this.confirmService, this.refundService);
  private readonly initService = new PaymentInitService(this.repo, this.confirmService);
  private readonly kora = new KoraClient();

  async initializePayment(
    userId: string,
    authenticatedEmail: string,
    input: InitializePaymentInput,
  ) {
    return this.initService.initializePayment(userId, authenticatedEmail, input);
  }

  async getPaymentRecord(reference: string) {
    return this.repo.findPaymentByReference(reference);
  }

  async getPaymentStatus(reference: string) {
    const record = await this.repo.findPaymentByReference(reference);
    if (!record) {
      throw createServiceError("Payment not found", 404);
    }
    return this.paymentWithExpiry(record);
  }

  private async paymentWithExpiry(paymentRecord: PaymentRecord) {
    let expiresAt: Date | null = null;
    if (paymentRecord.bookingId) {
      const bookingRecord = await db.query.booking.findFirst({
        where: eq(booking.id, paymentRecord.bookingId),
        columns: { expiresAt: true },
      });
      expiresAt = bookingRecord?.expiresAt ?? null;
    }
    return enrichWithExpiry(paymentRecord, expiresAt);
  }

  async transitionPendingPayment(
    reference: string,
    nextStatus: Extract<PaymentStatus, "failed" | "cancelled" | "expired">,
    reason: string,
    options?: {
      cleanupProjection?: boolean;
      failureCode?: string;
      failedAt?: Date | null;
      providerStatus?: string | null;
      rawVerificationResponse?: unknown;
    },
  ) {
    const existingPayment = await this.repo.findPaymentByReference(reference);
    if (!existingPayment) return null;
    if (existingPayment.status !== "pending") {
      return this.paymentWithExpiry(existingPayment);
    }

    const [updatedPayment] = await db.transaction(async (tx) => {
      const [record] = await tx
        .update(payment)
        .set({
          status: nextStatus,
          providerStatus:
            options?.providerStatus || existingPayment.providerStatus,
          rawVerificationResponse:
            options?.rawVerificationResponse ??
            existingPayment.rawVerificationResponse,
          lastStatusCheckAt: new Date(),
          failedAt: options?.failedAt ?? existingPayment.failedAt ?? new Date(),
          failureCode: options?.failureCode || existingPayment.failureCode,
          failureReason: reason,
          updatedAt: new Date(),
        })
        .where(
          and(eq(payment.reference, reference), eq(payment.status, "pending")),
        )
        .returning();

      if (!record) return [];

      await this.repo.updateBookingPaymentStatus(tx, {
        bookingId: record.bookingId,
        paymentReference: reference,
        paymentStatus: nextStatus,
      });

      return [record];
    });

    if (!updatedPayment) {
      const latest = await this.repo.findPaymentByReference(reference);
      return latest ? this.paymentWithExpiry(latest) : null;
    }

    logger.info("payment.failed", {
      bookingId: updatedPayment.bookingId,
      reference,
      status: nextStatus,
    });

    return this.paymentWithExpiry(updatedPayment);
  }

  async resolveReturnUrl(
    reference?: string | null,
    providerReturnStatus?: string | null,
  ) {
    const tripStatusUrl = `${this.config.FRONTEND_URL}/trip-status`;
    if (!reference) return tripStatusUrl;

    const existingPayment = await this.repo.findPaymentByReference(reference);
    if (!existingPayment) return tripStatusUrl;

    try {
      const verification = await this.kora.verifyTransaction(reference);
      const providerStatus = verification.data.status.toLowerCase();

      if (providerStatus === "success") {
        await this.confirmService.confirmPayment(
          reference,
          verification.data,
          verification.raw,
        );
        return tripStatusUrl;
      }

      if (
        ["failed", "cancelled", "abandoned", "closed"].includes(providerStatus)
      ) {
        await this.transitionPendingPayment(
          reference,
          providerStatus === "failed" ? "failed" : "cancelled",
          verification.data.message || "Payment was not completed",
          {
            failureCode:
              providerStatus === "failed" ? "PAYMENT_FAILED" : "USER_CANCELLED",
            providerStatus: verification.data.status,
            rawVerificationResponse: verification.raw,
          },
        );
        return tripStatusUrl;
      }

      const normalizedReturnStatus = providerReturnStatus?.trim().toLowerCase();
      if (
        normalizedReturnStatus &&
        ["failed", "cancelled", "abandoned", "closed"].includes(
          normalizedReturnStatus,
        )
      ) {
        logger.info("payment.return_status_ignored_after_verification", {
          reference,
          providerReturnStatus: normalizedReturnStatus,
          verifiedStatus: verification.data.status,
        });
      }

      let bookingExpiresAt: Date | null | undefined;
      if (existingPayment.bookingId) {
        const bookingRecord = await db.query.booking.findFirst({
          where: eq(booking.id, existingPayment.bookingId),
          columns: { expiresAt: true },
        });
        bookingExpiresAt = bookingRecord?.expiresAt;
      }

      if (bookingExpiresAt && bookingExpiresAt.getTime() > Date.now()) {
        return tripStatusUrl;
      }

      await this.transitionPendingPayment(
        reference,
        "expired",
        "Seat reservation expired before payment was completed",
        {
          failureCode: "PAYMENT_EXPIRED",
          providerStatus: verification.data.status,
          rawVerificationResponse: verification.raw,
        },
      );
    } catch (error) {
      logger.error("payment.return_verification_failed", {
        reference,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return tripStatusUrl;
  }

  async handleKoraWebhook(webhook: KoraWebhookPayload, signature?: string) {
    return this.webhookService.processWebhook(webhook, signature);
  }

  async processWebhookJob(job: WebhookJobData) {
    return this.webhookService.processWebhookJob(job);
  }

  async handlePaymentExpiry(payload: { bookingId: string; reference: string }) {
    return this.expiryService.expirePayment(payload);
  }

  isTerminalStatus(status: PaymentStatus) {
    return (TERMINAL_PAYMENT_STATUSES as readonly string[]).includes(status);
  }

}

export const paymentService = new PaymentService();
