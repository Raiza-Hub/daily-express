import { logger } from "../utils/logger";
import { db } from "../db/connection";
import { and, eq } from "drizzle-orm";
import { driver, earning, payout, payoutAttempt, type PayoutRecord, type EarningRecord } from "../db/index";
import { getConfig } from "../config/index";
import { generateReference } from "../utils/payment";
import { PayoutRepository, payoutRepository } from "./payout.repository";
import { PayoutRecipientService, payoutRecipientService } from "./payout-recipient.service";
import { PayoutAttemptService, payoutAttemptService } from "./payout-attempt.service";
import { PayoutNotificationService, payoutNotificationService } from "./payout-notification.service";
import { koraClient } from "../payment/kora.client";
import { jobService } from "../workers/jobService";
import {
  isFatalKoraError,
  isRetryableKoraError,
  KORA_ERROR_CODES,
  parseDelayString,
} from "../utils/payout";

type ActivePayoutDriver = typeof driver.$inferSelect & {
  bankVerificationStatus: "active";
};

const AMBIGUOUS_KORA_HTTP_STATUSES = new Set([500, 502, 503, 504]);

export class PayoutProcessorService {
  private readonly config = getConfig();
  private readonly payoutRetryDelaysMs = parseDelayString(
    this.config.PAYOUT_RETRY_DELAYS_MS,
  );
  private readonly kora = koraClient;

  constructor(
    private repo: PayoutRepository,
    private recipientService: PayoutRecipientService,
    private attemptService: PayoutAttemptService,
    private notificationService: PayoutNotificationService,
  ) {}

  async processEarningPayout(earningId: string) {
    const earningRecord = await this.repo.findEarningById(earningId);
    if (!earningRecord) return;
    if (
      earningRecord.status !== "available" &&
      earningRecord.status !== "processing"
    ) {
      return;
    }

    let payoutRecord = await this.getOrCreatePayout(earningRecord);
    if (
      payoutRecord.status === "success" ||
      payoutRecord.status === "permanent_failed"
    ) {
      return;
    }

    const payoutDriver = await this.getActivePayoutDriver(
      earningRecord.driverId,
    );
    if (!payoutDriver) {
      if (this.canRetry(payoutRecord.retryCount)) {
        await this.scheduleRetry(payoutRecord, "DRIVER_PROFILE_INCOMPLETE");
        return;
      }
      await this.notificationService.processPayoutFailure(
        payoutRecord,
        "DRIVER_PROFILE_INCOMPLETE",
        null,
        true,
      );
      return;
    }

    const recipient = await this.recipientService.getRecipient(payoutDriver);
    if (payoutRecord.recipientId !== recipient.id) {
      const [updated] = await db
        .update(payout)
        .set({
          recipientId: recipient.id,
          driverEmail: payoutDriver.email,
          updatedAt: new Date(),
        })
        .where(eq(payout.id, payoutRecord.id))
        .returning();
      payoutRecord = updated;
    }

    const balanceResult = await this.kora.getBalance();
    const availableBalance = Number.parseFloat(
      balanceResult.data?.NGN?.available_balance || "0",
    );
    const availableMinor = Math.round(availableBalance * 100);
    if (
      availableMinor <
      payoutRecord.amountMinor + this.config.MINIMUM_PAYOUT_BUFFER_MINOR
    ) {
      await this.scheduleRetry(
        payoutRecord,
        KORA_ERROR_CODES.INSUFFICIENT_BALANCE,
      );
      return;
    }

    await this.executeAttempt(payoutRecord, payoutDriver);
  }

  private async executeAttempt(
    payoutRecord: PayoutRecord,
    payoutDriver: ActivePayoutDriver,
  ) {
    const attemptNumber = payoutRecord.retryCount + 1;
    const reference = `${payoutRecord.reference}_attempt_${attemptNumber}`;

    if (attemptNumber > 1) {
      const previousAttempt = await this.repo.findPayoutAttempt(
        payoutRecord.id,
        attemptNumber - 1,
      );
      if (previousAttempt?.status === "settled") return;
      if (previousAttempt) {
        const outcome = await this.attemptService.verifyWithProvider(
          payoutRecord,
          previousAttempt,
        );
        if (outcome === "settled") return;
        if (outcome !== "failed") {
          await this.processVerificationRetryOutcome(payoutRecord, outcome);
          return;
        }
      }
    }

    // Prevents duplicate payout attempts: lock serializes creation and marks
    // the payout as "processing" before the external API call so concurrent
    // workers see the updated status and exit early.
    const attempt = await db.transaction(async (tx) => {
      const [lockedPayout] = await tx
        .select()
        .from(payout)
        .where(eq(payout.id, payoutRecord.id))
        .for("update")
        .limit(1);
      if (!lockedPayout) throw new Error("Payout not found");

      if (lockedPayout.status === "success" || lockedPayout.status === "permanent_failed") {
        return { attempt: null, alreadyFinalized: true };
      }

      const existing = await tx.query.payoutAttempt.findFirst({
        where: and(
          eq(payoutAttempt.payoutId, payoutRecord.id),
          eq(payoutAttempt.attemptNumber, attemptNumber),
        ),
      });
      if (existing) return { attempt: existing, alreadyFinalized: false };

      const [row] = await tx
        .insert(payoutAttempt)
        .values({
          payoutId: payoutRecord.id,
          attemptNumber,
          koraReference: reference,
          status: "pending",
        })
        .returning();

      await tx
        .update(payout)
        .set({
          status: "processing",
          nextRetryAt: null,
          failureCode: null,
          failureReason: null,
          updatedAt: new Date(),
        })
        .where(eq(payout.id, payoutRecord.id));

      if (payoutRecord.earningId) {
        await tx
          .update(earning)
          .set({
            status: "processing",
            payoutId: payoutRecord.id,
            updatedAt: new Date(),
          })
          .where(eq(earning.id, payoutRecord.earningId));
      }

      return { attempt: row, alreadyFinalized: false };
    });

    if (attempt.alreadyFinalized || !attempt.attempt) return;
    const currentAttempt = attempt.attempt;

    if (currentAttempt.status === "settled") return;
    if (
      currentAttempt.status === "pending" &&
      payoutRecord.status === "processing"
    ) {
      return;
    }
    if (currentAttempt.status === "pending_verification") {
      const outcome = await this.attemptService.verifyWithProvider(
        payoutRecord,
        currentAttempt,
      );
      if (outcome === "settled") return;
      if (outcome !== "failed") {
        await this.processVerificationRetryOutcome(payoutRecord, outcome);
        return;
      }
    }

    try {
      const result = await this.kora.initiatePayout({
        reference,
        amount: payoutRecord.amountMinor / 100,
        currency: payoutRecord.currency,
        bankCode: payoutDriver.bankCode,
        accountNumber: payoutDriver.accountNumber,
        accountName:
          payoutDriver.accountName ||
          `${payoutDriver.firstName} ${payoutDriver.lastName}`,
        customerEmail: payoutDriver.email,
        // narration: `Driver payout ${reference}`,
      });

      await db
        .update(payout)
        .set({
          providerTransferCode: result.data.reference,
          initiatedAt: new Date(),
          rawInitiateResponse: result.raw,
          updatedAt: new Date(),
        })
        .where(eq(payout.id, payoutRecord.id));
    } catch (error: any) {
      const errorCode = error?.koraErrorCode as string | undefined;
      const failureReason = error?.message || "Payout initiation failed";
      const shouldVerify = this.shouldVerifyAmbiguousInitiationError(
        errorCode,
        error,
      );

      await this.repo.updatePayoutAttemptByKey(
        payoutRecord.id,
        attemptNumber,
        {
          status: shouldVerify ? "pending_verification" : "failed",
          failureReason,
        },
      );

      if (errorCode === KORA_ERROR_CODES.INSUFFICIENT_BALANCE) {
        await this.scheduleRetry(payoutRecord, errorCode);
        return;
      }
      if (errorCode && isFatalKoraError(errorCode)) {
        await this.notificationService.processPayoutFailure(
          payoutRecord,
          errorCode,
          error,
          true,
        );
        return;
      }
      if (shouldVerify) {
        const attempt = await this.repo.findPayoutAttempt(
          payoutRecord.id,
          attemptNumber,
        );
        if (!attempt) throw error;
        const outcome = await this.attemptService.verifyWithProvider(
          payoutRecord,
          attempt,
        );
        if (outcome === "settled") return;
        if (outcome === "failed" && this.canRetry(payoutRecord.retryCount)) {
          await this.scheduleRetry(payoutRecord, "API_ERROR");
          return;
        }
        await this.processVerificationRetryOutcome(payoutRecord, outcome);
        return;
      }
      if (
        errorCode &&
        isRetryableKoraError(errorCode) &&
        this.canRetry(payoutRecord.retryCount)
      ) {
        await this.scheduleRetry(payoutRecord, "API_ERROR");
        return;
      }

      await this.notificationService.processPayoutFailure(
        payoutRecord,
        errorCode || "MAX_RETRIES_EXCEEDED",
        error,
        true,
      );
    }
  }

  private async processVerificationRetryOutcome(
    payoutRecord: PayoutRecord,
    outcome: string,
  ) {
    const reason =
      outcome === "processing"
        ? "PAYOUT_AWAITING_CONFIRMATION"
        : "PAYOUT_VERIFICATION_PENDING";
    if (this.canRetry(payoutRecord.retryCount)) {
      await this.scheduleRetry(payoutRecord, reason, { keepStatus: true });
      return;
    }
    await this.notificationService.processPayoutFailure(
      payoutRecord,
      reason,
      null,
      true,
    );
  }

  async scheduleRetry(
    payoutRecord: PayoutRecord,
    reason: string,
    options?: { keepStatus?: boolean },
  ) {
    if (!payoutRecord.earningId) {
      throw new Error("Cannot schedule payout retry without earningId");
    }
    const earningId = payoutRecord.earningId;

    const delayMs =
      reason === KORA_ERROR_CODES.INSUFFICIENT_BALANCE
        ? this.config.INSUFFICIENT_BALANCE_RETRY_DELAY_MS
        : this.payoutRetryDelaysMs[
            Math.min(
              payoutRecord.retryCount,
              Math.max(this.payoutRetryDelaysMs.length - 1, 0),
            )
          ] || 60_000;
    const nextRetryAt = new Date(Date.now() + delayMs);
    const newStatus = options?.keepStatus ? "processing" : "failed";

    await db.transaction(async (tx) => {
      const [lockedPayout] = await tx
        .select()
        .from(payout)
        .where(eq(payout.id, payoutRecord.id))
        .for("update")
        .limit(1);

      if (!lockedPayout) throw new Error("Payout not found");

      if (
        lockedPayout.status === "success" ||
        lockedPayout.status === "permanent_failed"
      ) {
        return;
      }

      await tx
        .update(payout)
        .set({
          status: newStatus,
          retryCount: lockedPayout.retryCount + 1,
          nextRetryAt,
          failureCode: reason,
          failureReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(payout.id, lockedPayout.id));

      await tx
        .update(earning)
        .set({
          status: "processing",
          payoutId: lockedPayout.id,
          updatedAt: new Date(),
        })
        .where(eq(earning.id, earningId));

      await jobService.enqueuePayout(tx, { earningId }, nextRetryAt);
    });
  }

  private async getOrCreatePayout(
    earningRecord: EarningRecord,
  ): Promise<PayoutRecord> {
    return db.transaction(async (tx) => {
      const existingPayout = await this.repo.findPayoutByEarningId(
        tx,
        earningRecord.id,
      );

      if (existingPayout) {
        if (earningRecord.payoutId !== existingPayout.id) {
          await tx
            .update(earning)
            .set({ payoutId: existingPayout.id, updatedAt: new Date() })
            .where(eq(earning.id, earningRecord.id));
        }
        return existingPayout;
      }

      const [createdPayout] = await this.repo.insertPayout(tx, {
        driverId: earningRecord.driverId,
        recipientId: earningRecord.driverId,
        earningId: earningRecord.id,
        reference: this.buildPayoutReference(),
        amountMinor: earningRecord.netAmountMinor,
        currency: earningRecord.currency || "NGN",
        earningsCount: 1,
        status: "processing",
      });

      const payoutRecord =
        createdPayout ||
        (await this.repo.findPayoutByEarningId(tx, earningRecord.id));
      if (!payoutRecord) {
        throw new Error(
          `Failed to create payout for earning ${earningRecord.id}`,
        );
      }

      await tx
        .update(earning)
        .set({ payoutId: payoutRecord.id, updatedAt: new Date() })
        .where(eq(earning.id, earningRecord.id));

      return payoutRecord;
    });
  }

  private async getActivePayoutDriver(
    driverId: string,
  ): Promise<ActivePayoutDriver | null> {
    const record = await this.repo.findDriverById(driverId);

    if (
      !record ||
      !record.isActive ||
      record.bankVerificationStatus !== "active" ||
      !record.bankCode ||
      !record.accountNumber ||
      !record.accountName ||
      !record.email
    ) {
      return null;
    }

    return record as ActivePayoutDriver;
  }

  canRetry(retryCount: number) {
    return retryCount < this.payoutRetryDelaysMs.length;
  }

  private buildPayoutReference() {
    return generateReference();
  }

  private shouldVerifyAmbiguousInitiationError(
    errorCode: string | undefined,
    error: unknown,
  ): boolean {
    if (errorCode) return false;
    const httpStatus =
      typeof error === "object" && error && "koraHttpStatus" in error
        ? Number((error as { koraHttpStatus?: unknown }).koraHttpStatus)
        : undefined;
    const networkError =
      typeof error === "object" && error && "koraNetworkError" in error
        ? Boolean((error as { koraNetworkError?: unknown }).koraNetworkError)
        : false;
    const serviceStatus =
      typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : undefined;

    return (
      networkError ||
      (httpStatus !== undefined &&
        AMBIGUOUS_KORA_HTTP_STATUSES.has(httpStatus)) ||
      serviceStatus === 502
    );
  }
}

export const payoutProcessorService = new PayoutProcessorService(
  payoutRepository,
  payoutRecipientService,
  payoutAttemptService,
  payoutNotificationService,
);
