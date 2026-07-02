import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, payment, refund, webhookProcessed } from "../db/index";
import { logger } from "../utils/logger";
import { getPaymentReference } from "../utils/payment";
import { jobService } from "../workers/job.service";
import type { WebhookJobData } from "../workers/boss";
import { koraClient } from "./kora.client";
import { PaymentRefundService, paymentRefundService } from "./payment-refund.service";
import { PaymentRepository, paymentRepository } from "./payment.repository";
import type {
    KoraWebhookPayload,
} from "./payment.types";

export class PaymentWebhookService {
  private readonly kora = koraClient;

  constructor(
    private repo: PaymentRepository,
    private refundService: PaymentRefundService,
  ) {}

  async processWebhook(webhook: KoraWebhookPayload, signature?: string) {
    const signatureValid = this.kora.verifyWebhookSignature(
      webhook.data,
      signature,
    );

    const dedupKey = `${webhook.event}:${webhook.data.payment_reference || webhook.data.reference}`;

    await db.transaction(async (tx) => {
      const [claimed] = await tx.insert(webhookProcessed)
        .values({
          eventType: webhook.event,
          eventReference: dedupKey,
        })
        .onConflictDoNothing()
        .returning({ id: webhookProcessed.id });

      if (!claimed) {
        logger.debug("payment.webhook_duplicate_skipped", {
          event: webhook.event,
          dedupKey,
        });
        return;
      }

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
        await this.processChargeSuccess(reference);
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

  private async processChargeSuccess(reference: string) {
    const [claimed] = await this.repo.claimPayment(reference);
    if (!claimed) {
      // Defensive check: if the payment is already in 'expired' status, but this webhook got a success callback,
      // check if a refund has already been created/processed to prevent double refunding.
      const existing = await this.repo.findPaymentByReference(reference);
      if (existing?.status === "expired" && existing.bookingId) {
        const existingRefund = await db.query.refund.findFirst({
          where: eq(refund.paymentId, existing.id),
        });
        if (!existingRefund) {
          logger.warn("payment.webhook.expired_without_refund", { reference, bookingId: existing.bookingId });
          const verification = await this.kora.verifyTransaction(reference);
          if (verification.data.status.toLowerCase() === "success") {
            try {
              await this.refundService.refundPayment(
                reference,
                {
                  amount: verification.data.amount,
                  currency: verification.data.currency,
                  paid_at: verification.data.paid_at,
                  payment_reference: verification.data.payment_reference,
                  reference: verification.data.reference,
                  status: verification.data.status,
                },
                verification.raw,
                "Payment completed after booking hold expired (webhook fallback)",
              );
            } catch (refundErr: unknown) {
              logger.error("payment.webhook.fallback_refund_failed", {
                reference,
                error: refundErr instanceof Error ? refundErr.message : String(refundErr),
              });
            }
          }
        }
      }
      logger.info("payment.webhook_already_claimed", { reference });
      return;
    }

    const verification = await this.kora.verifyTransaction(reference);
    if (verification.data.status.toLowerCase() !== "success") {
      await this.repo.updateProcessingPayment(reference, "failed", {
        failureCode: "VERIFICATION_MISMATCH",
        failureReason: `Webhook indicated success but verification returned ${verification.data.status}`,
        providerStatus: verification.data.status,
      });
      return;
    }

    let bookingExpired = true;
    if (claimed.bookingId) {
      const bookingRecord = await db.query.booking.findFirst({
        where: eq(booking.id, claimed.bookingId),
        columns: { expiresAt: true },
      });
      bookingExpired = !bookingRecord?.expiresAt || bookingRecord.expiresAt.getTime() <= Date.now();
    }

    if (bookingExpired) {
      await this.repo.updateProcessingPayment(reference, "expired", {
        failureCode: "BOOKING_EXPIRED",
        failureReason: "Payment completed after booking hold expired",
        providerStatus: "success",
      });

      await this.refundService.refundPayment(
        reference,
        verification.data,
        verification.raw,
        "Payment completed after booking hold expired",
      );
      return;
    }

    await db.transaction(async (tx) => {
      await tx.update(payment)
        .set({ status: "successful", paidAt: new Date(), providerStatus: "success", lastStatusCheckAt: new Date(), updatedAt: new Date() })
        .where(and(eq(payment.reference, reference), eq(payment.status, "processing")));

      await jobService.enqueue(tx, "allocation.process", {
        bookingId: claimed.bookingId,
        reference,
      });
    });
  }

  private async processChargeFailure(reference: string) {
    const verification = await this.kora.verifyTransaction(reference);

    if (verification.data.status.toLowerCase() === "success") {
      await this.processChargeSuccess(reference);
      return;
    }

    const [claimed] = await this.repo.claimPayment(reference);
    if (!claimed) {
      logger.info("payment.webhook_fail_already_claimed", { reference });
      return;
    }

    await this.repo.updateProcessingPayment(reference, "failed", {
      failureCode: "PAYMENT_FAILED",
      failureReason: verification.data.message || "Payment provider reported a failed charge",
      providerStatus: verification.data.status,
    });
  }
}

export const paymentWebhookService = new PaymentWebhookService(paymentRepository, paymentRefundService);
