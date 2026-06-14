import { logger } from "../utils/logger";
import { PayoutRepository } from "./payout.repository";
import { PayoutAttemptService } from "./payout-attempt.service";
import { PayoutProcessorService } from "./payout-processor.service";
import { PayoutNotificationService } from "./payout-notification.service";
import { KoraClient } from "../payment/kora.client";
import { parseMajorCurrencyToMinor } from "../utils/payout";
import type { KoraPayoutWebhookPayload } from "../payment/payment.types";

const WEBHOOK_RETRYABLE_PATTERNS = [
  "timeout",
  "bank processing",
  "processing error",
  "service unavailable",
  "unable to complete",
  "destination bank is not available",
];

const KORA_ERROR_CODES = {
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
} as const;

export class PayoutWebhookService {
  private readonly kora = new KoraClient();

  constructor(
    private repo: PayoutRepository,
    private attemptService: PayoutAttemptService,
    private processorService: PayoutProcessorService,
    private notificationService: PayoutNotificationService,
  ) {}

  async processWebhook(input: {
    signature?: string;
    event: KoraPayoutWebhookPayload;
  }) {
    const signatureValid = this.kora.verifyWebhookSignature(
      input.event.data,
      input.signature,
    );

    const [webhookRecord] = await this.repo.insertWebhook({
      eventType: input.event.event,
      reference: input.event.data.reference || null,
      signatureValid,
      payload: input.event,
    });

    if (!signatureValid) {
      await this.repo.updateWebhookProcessedAt(webhookRecord.id);
      return { processed: false, signatureValid };
    }

    const reference = input.event.data.reference;
    if (!reference) {
      await this.repo.updateWebhookProcessedAt(webhookRecord.id);
      return { processed: false, signatureValid };
    }

    const attempt = await this.repo.findPayoutAttemptByReference(reference);
    if (!attempt) {
      await this.repo.updateWebhookProcessedAt(webhookRecord.id);
      return { processed: false, signatureValid };
    }

    const payoutRecord = await this.repo.findPayoutById(attempt.payoutId);
    if (!payoutRecord) {
      await this.repo.updateWebhookProcessedAt(webhookRecord.id);
      return { processed: false, signatureValid };
    }

    if (input.event.event === "transfer.success") {
      if (
        payoutRecord.status === "permanent_failed" ||
        payoutRecord.status === "success" ||
        attempt.status === "settled"
      ) {
        await this.repo.updateWebhookProcessedAt(webhookRecord.id);
        return { processed: true, signatureValid };
      }

      await this.attemptService.settleAttempt(
        payoutRecord,
        attempt,
        input.event,
        parseMajorCurrencyToMinor(input.event.data.fee),
      );
      await this.repo.updateWebhookProcessedAt(webhookRecord.id);
      return { processed: true, signatureValid };
    }

    if (input.event.event === "transfer.failed") {
      if (
        payoutRecord.status === "success" ||
        payoutRecord.status === "permanent_failed" ||
        attempt.status === "settled" ||
        attempt.status === "failed"
      ) {
        await this.repo.updateWebhookProcessedAt(webhookRecord.id);
        return { processed: true, signatureValid };
      }

      const failureReason = this.getWebhookFailureReason(input.event);
      await this.repo.updatePayoutAttempt(attempt.id, {
        status: "failed",
        failureReason,
        rawWebhook: input.event,
      });

      if (failureReason === KORA_ERROR_CODES.INSUFFICIENT_BALANCE) {
        await this.processorService.scheduleRetry(payoutRecord, failureReason);
      } else if (
        this.isRetryableFailure(failureReason) &&
        this.processorService.canRetry(payoutRecord.retryCount)
      ) {
        await this.processorService.scheduleRetry(payoutRecord, "API_ERROR");
      } else {
        await this.notificationService.handlePayoutFailure(
          payoutRecord,
          failureReason,
          input.event,
          true,
        );
      }

      await this.repo.updateWebhookProcessedAt(webhookRecord.id);
      return { processed: true, signatureValid };
    }

    await this.repo.updateWebhookProcessedAt(webhookRecord.id);
    return { processed: false, signatureValid };
  }

  private getWebhookFailureReason(event: KoraPayoutWebhookPayload): string {
    const message = (event.data.message || "").trim();
    if (message.toLowerCase().includes("insufficient")) {
      return KORA_ERROR_CODES.INSUFFICIENT_BALANCE;
    }
    return message || "Transfer failed";
  }

  private isRetryableFailure(message: string): boolean {
    const normalized = message.toLowerCase();
    return WEBHOOK_RETRYABLE_PATTERNS.some((pattern) =>
      normalized.includes(pattern),
    );
  }
}
