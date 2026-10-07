import { db } from "../db/connection";
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
      await this.processTransferWebhook(webhook, signature);
      return;
    }

    const signatureValid = this.kora.verifyWebhookSignature(
      webhook.data,
      signature,
    );

    const paymentRef = webhook.data.reference;
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

  private async processTransferWebhook(
    webhook: KoraWebhookPayload,
    signature?: string,
  ) {
    const reference = webhook.data.reference;
    if (!reference) {
      logger.warn("payment.transfer_webhook_missing_reference", {
        event: webhook.event,
      });
      return;
    }

    const refundRecord = await this.repo.findRefundByReference(reference);
    if (!refundRecord) {
      await payoutWebhookService.processWebhook({
        signature,
        event: webhook as KoraPayoutWebhookPayload,
      });
      return;
    }

    const signatureValid = this.kora.verifyWebhookSignature(
      webhook.data,
      signature,
    );
    if (!signatureValid) {
      logger.warn("payment.transfer_webhook_invalid_signature_ignored", {
        event: webhook.event,
        reference,
      });
      return;
    }

    await this.payoutRefundService.finalizeRefund(
      refundRecord.id,
      webhook.event === "transfer.success" ? "successful" : "failed",
    );
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
    await db.transaction(async (tx) => {
      const [settled] = await this.repo.settlePayment(
        tx,
        reference,
        "successful",
      );
      if (!settled) {
        logger.info("payment.webhook_already_terminal", { reference });
        return;
      }

      await jobService.enqueuePayerInfoBackfill(tx, { reference });

      if (settled.bookingId) {
        await bookingFinalizerService.finalizeBooking(tx, settled.bookingId, reference);
      }
    });
  }

  private async processChargeFailure(reference: string) {
    const [settled] = await db.transaction((tx) =>
      this.repo.settlePayment(tx, reference, "failed"),
    );
    if (!settled) {
      logger.info("payment.webhook_already_terminal", { reference });
      return;
    }
  }
}
