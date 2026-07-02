import { logger } from "../utils/logger";
import { db } from "../db/connection";
import { and, eq } from "drizzle-orm";
import { payout as payoutTable, payoutAttempt } from "../db/index";
import { PayoutRepository, payoutRepository } from "./payout.repository";
import { PayoutAttemptService, payoutAttemptService } from "./payout-attempt.service";
import { PayoutProcessorService, payoutProcessorService } from "./payout-processor.service";
import { PayoutNotificationService, payoutNotificationService } from "./payout-notification.service";
import { koraClient } from "../payment/kora.client";
import { parseMajorCurrencyToMinor, KORA_ERROR_CODES } from "../utils/payout";
import type { KoraPayoutWebhookPayload } from "../payment/payment.types";

const WEBHOOK_RETRYABLE_PATTERNS = [
  "timeout",
  "bank processing",
  "processing error",
  "service unavailable",
  "unable to complete",
  "destination bank is not available",
];

export class PayoutWebhookService {
  private readonly kora = koraClient;

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

      await this.attemptService.finalizeAttempt(
        payoutRecord,
        attempt,
        input.event,
        parseMajorCurrencyToMinor(input.event.data.fee),
      );
      await this.repo.updateWebhookProcessedAt(webhookRecord.id);
      return { processed: true, signatureValid };
    }

    if (input.event.event === "transfer.failed") {
      const failureReason = this.getWebhookFailureReason(input.event);

      const result = await db.transaction(async (tx) => {
        const [lockedPayout] = await tx
          .select()
          .from(payoutTable)
          .where(eq(payoutTable.id, attempt.payoutId))
          .for("update")
          .limit(1);

        if (!lockedPayout) return { action: "skip" as const };

        const [lockedAttempt] = await tx
          .select()
          .from(payoutAttempt)
          .where(eq(payoutAttempt.id, attempt.id))
          .for("update")
          .limit(1);

        if (!lockedAttempt) return { action: "skip" as const };

        if (
          lockedPayout.status === "success" ||
          lockedPayout.status === "permanent_failed" ||
          lockedAttempt.status === "settled" ||
          lockedAttempt.status === "failed"
        ) {
          return { action: "skip" as const };
        }

        await tx
          .update(payoutAttempt)
          .set({
            status: "failed",
            failureReason,
            rawWebhook: input.event,
          })
          .where(eq(payoutAttempt.id, lockedAttempt.id));

        return { action: "process" as const, payout: lockedPayout };
      });

      if (result.action === "skip") {
        await this.repo.updateWebhookProcessedAt(webhookRecord.id);
        return { processed: true, signatureValid };
      }

      const currentPayout = result.payout;

      if (failureReason === KORA_ERROR_CODES.INSUFFICIENT_BALANCE) {
        await this.processorService.scheduleRetry(currentPayout, failureReason);
      } else if (
        this.isRetryableFailure(failureReason) &&
        this.processorService.canRetry(currentPayout.retryCount)
      ) {
        await this.processorService.scheduleRetry(currentPayout, "API_ERROR");
      } else {
        await this.notificationService.processPayoutFailure(
          currentPayout,
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

export const payoutWebhookService = new PayoutWebhookService(
  payoutRepository,
  payoutAttemptService,
  payoutProcessorService,
  payoutNotificationService,
);
