import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { payment } from "../db/index";
import { logger } from "../utils/logger";
import { getPaymentReference } from "../utils/payment";
import { bookingFinalizerService } from "../route/booking-finalizer.service";
import type { WebhookJobData } from "../workers/boss";
import { jobService } from "../workers/job.service";
import { koraClient } from "./kora.client";
import { PaymentRepository } from "./payment.repository";
import { PaymentPayoutRefundService } from "./payment-payout-refund.service";
import { payoutWebhookService } from "../payout/payout-webhook.service";
import type {
    KoraPayoutWebhookPayload,
    KoraWebhookPayload,
} from "./payment.types";

export class PaymentWebhookService {
  private readonly kora = koraClient;

  constructor(
    private repo: PaymentRepository,
    private payoutRefundService: PaymentPayoutRefundService,
  ) {}

  async processWebhook(webhook: KoraWebhookPayload, signature?: string) {
    if (webhook.event.startsWith("transfer.")) {
      if (webhook.data.reference?.startsWith("REF-")) {
        const signatureValid = this.kora.verifyWebhookSignature(
          webhook.data,
          signature,
        );

        const actualRef = webhook.data.reference.slice(4);

        if (signatureValid) {
          const targetStatus = webhook.event === "transfer.success" ? "refunded" : "refund_failed";
          await this.payoutRefundService.finalizeRefund(actualRef, targetStatus);
        }
      } else {
        await payoutWebhookService.processWebhook({
          signature,
          event: webhook as KoraPayoutWebhookPayload,
        });
      }
      return;
    }

    const signatureValid = this.kora.verifyWebhookSignature(
      webhook.data,
      signature,
    );

    const paymentRef = webhook.data.payment_reference || webhook.data.reference;
    if (!paymentRef) {
      logger.warn("payment.webhook_missing_reference", { event: webhook.event });
      return;
    }

    if (signatureValid) {
      await this.processWebhookJob({
        event: webhook.event,
        data: webhook.data,
        _retryCount: 0,
      });
    }

    if (!signatureValid) {
      logger.warn("payment.webhook_invalid_signature_ignored", {
        event: webhook.event,
        paymentReference: paymentRef,
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
      default:
        logger.info("payment.webhook_ignored", { event: job.event, reference });
    }
  }

  private async processChargeSuccess(reference: string) {
    const [claimed] = await this.repo.claimPayment(reference);
    if (!claimed) {
      logger.info("payment.webhook_already_claimed", { reference });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.update(payment)
        .set({
          status: "successful",
          updatedAt: new Date(),
        })
        .where(and(eq(payment.reference, reference), eq(payment.status, "processing")));

      await jobService.enqueuePayerInfoBackfill(tx, { reference });
    });

    if (claimed.bookingId) {
      await bookingFinalizerService.finalizeBooking(claimed.bookingId, reference);
    }
  }

  private async processChargeFailure(reference: string) {
    const [claimed] = await this.repo.claimPayment(reference);
    if (!claimed) {
      logger.info("payment.webhook_fail_already_claimed", { reference });
      return;
    }

    await this.repo.updateProcessingPayment(reference, "failed");
  }
}
