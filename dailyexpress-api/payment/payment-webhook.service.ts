import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, payment } from "../db/index";
import { logger } from "../utils/logger";
import { getPaymentReference } from "../utils/payment";
import type { WebhookJobData } from "../workers/boss";
import { jobService } from "../workers/jobService";
import { KoraClient } from "./kora.client";
import { PaymentConfirmService } from "./payment-confirm.service";
import { PaymentRefundService } from "./payment-refund.service";
import { PaymentRepository } from "./payment.repository";
import type {
    KoraWebhookPayload,
    PaymentStatus,
} from "./payment.types";
import { enrichWithExpiry } from "./payment.utils";

type PaymentRecord = typeof payment.$inferSelect;

export class PaymentWebhookService {
  private readonly kora = new KoraClient();

  constructor(
    private repo: PaymentRepository,
    private confirmService: PaymentConfirmService,
    private refundService: PaymentRefundService,
  ) {}

  async processWebhook(webhook: KoraWebhookPayload, signature?: string) {
    const signatureValid = this.kora.verifyWebhookSignature(
      webhook.data,
      signature,
    );

    await db.transaction(async (tx) => {
      await this.repo.insertWebhook(tx, {
        provider: "kora",
        paymentReference:
          webhook.data.payment_reference || webhook.data.reference || null,
        eventType: webhook.event,
        signatureValid,
        payload: webhook,
        verificationNote: signatureValid
          ? "Webhook signature verified and queued"
          : "Webhook signature verification failed",
      });

      if (signatureValid) {
        await jobService.enqueuePaymentWebhook(tx, {
          event: webhook.event,
          data: webhook.data,
          _retryCount: 0,
        });
      }
    });

    if (!signatureValid) {
      logger.warn("payment.webhook_invalid_signature_ignored", {
        event: webhook.event,
        paymentReference:
          webhook.data.payment_reference || webhook.data.reference || null,
      });
    }
  }

  async processWebhookJob(job: WebhookJobData) {
    const reference = getPaymentReference(job);
    if (!reference) {
      logger.warn("payment.webhook_missing_reference", { event: job.event });
      return;
    }

    switch (job.event) {
      case "charge.success":
        await this.processChargeSuccess(job, reference);
        return;
      case "charge.failed":
        await this.processChargeFailure(reference);
        return;
      case "refund.success":
        await this.refundService.finalizeRefund(reference, "refunded");
        return;
      case "refund.failed":
        await this.refundService.finalizeRefund(reference, "refund_failed");
        return;
      default:
        logger.info("payment.webhook_ignored", { event: job.event, reference });
    }
  }

  private async processChargeSuccess(job: WebhookJobData, reference: string) {
    const existingPayment = await this.repo.findPaymentByReference(reference);
    if (existingPayment && existingPayment.status !== "pending") {
      if (
        existingPayment.status === "failed" ||
        existingPayment.status === "expired"
      ) {
        logger.info("payment.webhook_post_expiry_success", {
          reference,
          currentStatus: existingPayment.status,
        });

        const verification = await this.kora.verifyTransaction(reference);
        if (verification.data.status.toLowerCase() === "success") {
          await this.refundService.refundPayment(
            reference,
            verification.data,
            verification.raw,
            "Payment completed after booking hold expired",
          );
          return;
        }

        logger.warn("payment.webhook_success_mismatch", {
          koraStatus: verification.data.status,
          reference,
        });
      }

      logger.info("payment.webhook_duplicate_terminal", {
        event: job.event,
        reference,
      });
      return;
    }

    const verification = await this.kora.verifyTransaction(reference);
    if (verification.data.status.toLowerCase() !== "success") {
      logger.warn("payment.webhook_success_verification_mismatch", {
        koraStatus: verification.data.status,
        reference,
      });
      return;
    }

    if (!existingPayment) {
      logger.warn("payment.webhook_success_missing_payment", { reference });
      return;
    }

    let bookingExpiresAt: Date | null | undefined;
    if (existingPayment.bookingId) {
      const bookingRecord = await db.query.booking.findFirst({
        where: eq(booking.id, existingPayment.bookingId),
        columns: { expiresAt: true },
      });
      bookingExpiresAt = bookingRecord?.expiresAt;
    }

    if (!bookingExpiresAt || bookingExpiresAt.getTime() <= Date.now()) {
      await this.refundService.refundPayment(
        reference,
        verification.data,
        verification.raw,
      );
      return;
    }

    await this.confirmService.confirmPayment(
      reference,
      verification.data,
      verification.raw,
    );
  }

  private async processChargeFailure(reference: string) {
    const verification = await this.kora.verifyTransaction(reference);

    if (verification.data.status.toLowerCase() === "success") {
      await this.processChargeSuccess(
        {
          event: "charge.success",
          data: { ...verification.data, reference },
          _retryCount: 0,
        },
        reference,
      );
      return;
    }

    await this.failPayment(
      reference,
      "failed",
      verification.data.message || "Payment provider reported a failed charge",
      {
        failureCode: "PAYMENT_FAILED",
        providerStatus: verification.data.status,
      },
    );
  }

  private async failPayment(
    reference: string,
    nextStatus: Extract<PaymentStatus, "failed" | "cancelled" | "expired">,
    reason: string,
    options?: {
      failureCode?: string;
      providerStatus?: string | null;
    },
  ) {
    const existingPayment = await this.repo.findPaymentByReference(reference);
    if (!existingPayment) return null;
    if (existingPayment.status !== "pending") {
      return enrichWithExpiry(existingPayment);
    }

    const [updatedPayment] = await db.transaction(async (tx) => {
      const [record] = await tx
        .update(payment)
        .set({
          status: nextStatus,
          providerStatus:
            options?.providerStatus || existingPayment.providerStatus,
          lastStatusCheckAt: new Date(),
          failedAt: existingPayment.failedAt || new Date(),
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
      return latest ? enrichWithExpiry(latest) : null;
    }

    logger.info("payment.failed", {
      bookingId: updatedPayment.bookingId,
      reference,
      status: nextStatus,
    });

    return enrichWithExpiry(updatedPayment);
  }

}
