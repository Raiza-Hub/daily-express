import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { sentryServer } from "@shared/sentry";
import type {
  DriverPayoutBalance,
  DriverPendingPayoutTrip,
  DriverPayoutHistoryItem,
  DriverPayoutSummary,
  DriverPayoutSummaryDay,
  JWTPayload,
  ResolveBankAccountResponse,
} from "@shared/types";
import type {
  BookingCancelledEvent,
  BookingConfirmedEvent,
  DriverBankVerificationRequestedEvent,
  DriverPayoutProfileDeletedEvent,
  DriverPayoutProfileUpsertedEvent,
  TripCancelledEvent,
  TripCompletedEvent,
} from "@shared/kafka";
import { logger } from "@shared/logger";
import { createServiceError } from "@shared/utils";
import { db } from "../db/db";
import {
  consumedEvent,
  driverPayoutProfile,
  earning,
  payout,
  payoutAttempt,
  payoutRecipient,
  payoutWebhook,
} from "../db/schema";
import { loadConfig } from "./config";
import {
  emitDriverBankVerificationFailed,
  emitDriverBankVerified,
  emitPayoutCompleted,
  emitPayoutFailed,
} from "./kafka/producer";
import {
  FATAL_KORA_ERRORS,
  isFatalKoraError,
  isRetryableKoraError,
  KoraClient,
  KORA_ERROR_CODES,
  verifyKoraWebhookSignature,
} from "./kora.client";
import { boss } from "./queue";
import type {
  DriverPendingPayoutTripRow,
  KoraPayoutWebhookPayload,
  PayoutHistoryQuery,
} from "./types";

type EarningRecord = typeof earning.$inferSelect;
type DriverPayoutProfileRecord = typeof driverPayoutProfile.$inferSelect;
type ActiveDriverPayoutProfile = DriverPayoutProfileRecord & {
  email: string;
  firstName: string;
  lastName: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  bankVerificationStatus: "active";
  deletedAt: null;
  isActive: true;
};
type PayoutRecord = typeof payout.$inferSelect;
type PayoutAttemptRecord = typeof payoutAttempt.$inferSelect;

const WEBHOOK_RETRYABLE_PATTERNS = [
  "timeout",
  "bank processing",
  "processing error",
  "service unavailable",
  "unable to complete",
  "destination bank is not available",
];
const AMBIGUOUS_KORA_HTTP_STATUSES = new Set([500, 502, 503, 504]);
type AttemptVerificationOutcome =
  | "settled"
  | "failed"
  | "processing"
  | "unknown";

export const PayoutMetrics = {
  INITIATED: "payout.initiated",
  SETTLED: "payout.settled",
  FAILED_TRANSIENT: "payout.failed.transient",
  FAILED_BALANCE: "payout.failed.insufficient_balance",
  FAILED_PERMANENT: "payout.failed.permanent",
  RETRY_SCHEDULED: "payout.retry.scheduled",
  WEBHOOK_RECEIVED: "payout.webhook.received",
  WEBHOOK_DUPLICATE: "payout.webhook.duplicate",
  BALANCE_PREFLIGHT: "payout.balance_preflight.failed",
} as const;

export class PayoutService {
  private readonly config = loadConfig();
  private readonly koraClient = new KoraClient();

  private calculatePlatformFeeAmountMinor(amountMinor: number): number {
    return Math.round(amountMinor * 0.1);
  }

  async handleBookingConfirmed(event: BookingConfirmedEvent, topic: string) {
    if (await this.hasConsumedEvent(event.eventId)) {
      return;
    }

    const existingEarning = await db.query.earning.findFirst({
      where: eq(earning.bookingId, event.payload.bookingId),
    });

    if (!existingEarning) {
      const feeAmountMinor = this.calculatePlatformFeeAmountMinor(
        event.payload.fareAmountMinor,
      );

      await db.insert(earning).values({
        driverId: event.payload.driverId,
        bookingId: event.payload.bookingId,
        tripId: event.payload.tripId,
        routeId: event.payload.routeId,
        tripDate: new Date(event.payload.tripDate),
        pickupTitle: event.payload.pickupTitle,
        dropoffTitle: event.payload.dropoffTitle,
        grossAmountMinor: event.payload.fareAmountMinor,
        feeAmountMinor,
        netAmountMinor: event.payload.fareAmountMinor - feeAmountMinor,
        currency: event.payload.currency,
        status: "pending_trip_completion",
        sourceEventId: event.eventId,
      });
    }

    await this.markEventConsumed(event.eventId, topic);
  }

  async handleTripCompleted(event: TripCompletedEvent, topic: string) {
    if (await this.hasConsumedEvent(event.eventId)) {
      return;
    }

    const releasedEarnings = await db
      .update(earning)
      .set({
        status: "available",
        availableAt: new Date(event.payload.completedAt),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(earning.tripId, event.payload.tripId),
          eq(earning.status, "pending_trip_completion"),
        ),
      )
      .returning({ id: earning.id });

    await Promise.all(
      releasedEarnings.map((entry) => this.enqueuePayoutJob(entry.id)),
    );

    await this.markEventConsumed(event.eventId, topic);
  }

  async handleBookingCancelled(event: BookingCancelledEvent, topic: string) {
    if (await this.hasConsumedEvent(event.eventId)) {
      return;
    }

    const existingEarning = await db.query.earning.findFirst({
      where: eq(earning.bookingId, event.payload.bookingId),
    });

    if (existingEarning) {
      const nextStatus =
        existingEarning.status === "paid" ? "manual_review" : "cancelled";

      await db
        .update(earning)
        .set({
          status: nextStatus,
          payoutId:
            nextStatus === "cancelled" ? null : existingEarning.payoutId,
          updatedAt: new Date(),
        })
        .where(eq(earning.id, existingEarning.id));
    }

    await this.markEventConsumed(event.eventId, topic);
  }

  async handleTripCancelled(event: TripCancelledEvent, topic: string) {
    if (await this.hasConsumedEvent(event.eventId)) {
      return;
    }

    const tripEarnings = await db.query.earning.findMany({
      where: eq(earning.tripId, event.payload.tripId),
    });

    for (const tripEarning of tripEarnings) {
      const nextStatus =
        tripEarning.status === "paid" ? "manual_review" : "cancelled";

      await db
        .update(earning)
        .set({
          status: nextStatus,
          payoutId: nextStatus === "cancelled" ? null : tripEarning.payoutId,
          updatedAt: new Date(),
        })
        .where(eq(earning.id, tripEarning.id));
    }

    await this.markEventConsumed(event.eventId, topic);
  }

  async handleDriverBankVerificationRequested(
    event: DriverBankVerificationRequestedEvent,
    topic: string,
  ) {
    if (await this.hasConsumedEvent(event.eventId)) {
      return;
    }

    try {
      const resolved = await this.koraClient.resolveAccountNumber(
        event.payload.bankCode,
        event.payload.accountNumber,
        event.payload.currency,
      );

      await emitDriverBankVerified({
        driverId: event.payload.driverId,
        bankName: event.payload.bankName,
        bankCode: event.payload.bankCode,
        accountNumber: event.payload.accountNumber,
        accountName: resolved.data.account_name,
        currency: event.payload.currency,
      });
    } catch (error) {
      sentryServer.captureException(error, event.payload.driverId, {
        action: "handleDriverBankVerificationRequested",
        values: { event: event.payload, topic },
      });
      await emitDriverBankVerificationFailed({
        driverId: event.payload.driverId,
        bankName: event.payload.bankName,
        bankCode: event.payload.bankCode,
        accountNumber: event.payload.accountNumber,
        reason:
          error instanceof Error ? error.message : "Bank verification failed",
        currency: event.payload.currency,
      });
    }

    await this.markEventConsumed(event.eventId, topic);
  }

  async handleDriverPayoutProfileUpserted(
    event: DriverPayoutProfileUpsertedEvent,
    topic: string,
  ) {
    if (await this.hasConsumedEvent(event.eventId)) {
      return;
    }

    const payload = event.payload;
    const sourceUpdatedAt = new Date(payload.updatedAt);
    const existingProfile = await db.query.driverPayoutProfile.findFirst({
      where: eq(driverPayoutProfile.driverId, payload.driverId),
    });

    const nextValues = {
      userId: payload.userId,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      currency: payload.currency,
      isActive: payload.isActive,
      bankName: payload.bankName,
      bankCode: payload.bankCode,
      accountNumber: payload.accountNumber,
      accountName: payload.accountName,
      bankVerificationStatus: payload.bankVerificationStatus,
      bankVerificationFailureReason: payload.bankVerificationFailureReason,
      sourceUpdatedAt,
      deletedAt: null,
      updatedAt: new Date(),
    };

    if (existingProfile) {
      await db
        .update(driverPayoutProfile)
        .set(nextValues)
        .where(eq(driverPayoutProfile.driverId, payload.driverId));
    } else {
      await db.insert(driverPayoutProfile).values({
        driverId: payload.driverId,
        createdAt: new Date(),
        ...nextValues,
      });
    }

    await this.markEventConsumed(event.eventId, topic);
  }

  async handleDriverPayoutProfileDeleted(
    event: DriverPayoutProfileDeletedEvent,
    topic: string,
  ) {
    if (await this.hasConsumedEvent(event.eventId)) {
      return;
    }

    const payload = event.payload;
    const deletedAt = new Date(payload.deletedAt);
    const existingProfile = await db.query.driverPayoutProfile.findFirst({
      where: eq(driverPayoutProfile.driverId, payload.driverId),
    });

    if (existingProfile) {
      await db
        .update(driverPayoutProfile)
        .set({
          userId: payload.userId,
          isActive: false,
          deletedAt,
          updatedAt: new Date(),
        })
        .where(eq(driverPayoutProfile.driverId, payload.driverId));
    } else {
      await db.insert(driverPayoutProfile).values({
        driverId: payload.driverId,
        userId: payload.userId,
        isActive: false,
        deletedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await this.markEventConsumed(event.eventId, topic);
  }

  async enqueuePayoutJob(earningId: string): Promise<void> {
    await boss.send(
      "process-payout",
      { earningId },
      {
        singletonKey: earningId,
        retryLimit: 0,
      },
    );
  }

  async triggerPayout(earningId: string): Promise<void> {
    const earningRecord = await db.query.earning.findFirst({
      where: eq(earning.id, earningId),
    });

    if (!earningRecord) {
      logger.warn("payout.earning_missing", { earningId });
      return;
    }

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

    const driver = await this.getDriverPayoutProfile(earningRecord.driverId);

    if (!driver) {
      if (this.canRetry(payoutRecord.retryCount)) {
        await this.scheduleRetry(payoutRecord, "DRIVER_PROFILE_UNAVAILABLE");
        return;
      }

      await this.finalizePermanentFailure(
        payoutRecord,
        "DRIVER_PROFILE_UNAVAILABLE",
        null,
      );
      throw new Error("PERMANENT_FAILURE:DRIVER_PROFILE_UNAVAILABLE");
    }

    if (!driver.isActive || driver.deletedAt) {
      await this.finalizePermanentFailure(
        payoutRecord,
        "DRIVER_INACTIVE",
        null,
      );
      throw new Error("PERMANENT_FAILURE:DRIVER_INACTIVE");
    }

    if (driver.bankVerificationStatus === "failed") {
      await this.finalizePermanentFailure(
        payoutRecord,
        "BANK_VERIFICATION_FAILED",
        null,
      );
      throw new Error("PERMANENT_FAILURE:BANK_VERIFICATION_FAILED");
    }

    if (
      driver.bankVerificationStatus !== "active" ||
      !driver.bankCode ||
      !driver.accountNumber ||
      !driver.accountName ||
      !driver.email
    ) {
      if (this.canRetry(payoutRecord.retryCount)) {
        await this.scheduleRetry(payoutRecord, "DRIVER_PROFILE_INCOMPLETE");
        return;
      }

      await this.finalizePermanentFailure(
        payoutRecord,
        "DRIVER_PROFILE_INCOMPLETE",
        null,
      );
      throw new Error("PERMANENT_FAILURE:DRIVER_PROFILE_INCOMPLETE");
    }

    const payoutDriver = this.toActiveDriverPayoutProfile(driver);

    try {
      const recipient = await this.ensureRecipient(
        payoutDriver.driverId,
        payoutDriver,
      );
      if (payoutRecord.recipientId !== recipient.id) {
        [payoutRecord] = await db
          .update(payout)
          .set({
            recipientId: recipient.id,
            driverEmail: payoutDriver.email || payoutRecord.driverEmail,
            updatedAt: new Date(),
          })
          .where(eq(payout.id, payoutRecord.id))
          .returning();
      }
    } catch (error: any) {
      sentryServer.captureException(error, payoutDriver.driverId, {
        action: "triggerPayout_ensureRecipient",
        values: { earningId, driverId: payoutDriver.driverId },
      });
      const errorCode = error?.koraErrorCode as string | undefined;

      if (errorCode && FATAL_KORA_ERRORS.has(errorCode)) {
        await this.finalizePermanentFailure(payoutRecord, errorCode, error);
        throw new Error(`PERMANENT_FAILURE:${errorCode}`);
      }

      if (this.canRetry(payoutRecord.retryCount)) {
        await this.scheduleRetry(payoutRecord, "RECIPIENT_SETUP_ERROR");
        return;
      }

      await this.finalizePermanentFailure(
        payoutRecord,
        "RECIPIENT_SETUP_ERROR",
        error,
      );
      throw new Error("PERMANENT_FAILURE:RECIPIENT_SETUP_ERROR");
    }

    const balanceResult = await this.koraClient.getBalance();
    const availableBalance = parseFloat(
      balanceResult.data?.NGN?.available_balance || "0",
    );
    const availableMinor = Math.round(availableBalance * 100);

    if (
      availableMinor <
      payoutRecord.amountMinor + this.config.minimumPayoutBufferMinor
    ) {
      await this.scheduleRetry(
        payoutRecord,
        KORA_ERROR_CODES.INSUFFICIENT_BALANCE,
      );
      return;
    }

    await this.processPayoutAttempt(payoutRecord, payoutDriver);
  }

  async emitFailureForPermanentPayout(earningId: string): Promise<void> {
    const payoutRecord = await db.query.payout.findFirst({
      where: eq(payout.earningId, earningId),
    });

    if (!payoutRecord || payoutRecord.status !== "permanent_failed") {
      return;
    }

    await this.emitFailureEvent(payoutRecord);
  }

  async getBalance(user: JWTPayload): Promise<DriverPayoutBalance> {
    const driver = await this.getCurrentDriver(user);
    if (!driver || !driver.isActive || driver.deletedAt) {
      return {
        pendingAmountMinor: 0,
        availableAmountMinor: 0,
        processingAmountMinor: 0,
        paidAmountMinor: 0,
        nextAutoPayoutAt: null,
      };
    }

    const earnings = await db.query.earning.findMany({
      where: eq(earning.driverId, driver.driverId),
      columns: {
        status: true,
        netAmountMinor: true,
      },
    });

    const totals = earnings.reduce(
      (acc, item) => {
        if (item.status === "pending_trip_completion") {
          acc.pendingAmountMinor += item.netAmountMinor;
        } else if (item.status === "available") {
          acc.availableAmountMinor += item.netAmountMinor;
        } else if (item.status === "paid") {
          acc.paidAmountMinor += item.netAmountMinor;
        } else if (item.status === "reserved" || item.status === "processing") {
          acc.processingAmountMinor += item.netAmountMinor;
        }
        return acc;
      },
      {
        pendingAmountMinor: 0,
        availableAmountMinor: 0,
        processingAmountMinor: 0,
        paidAmountMinor: 0,
      },
    );

    return {
      ...totals,
      nextAutoPayoutAt: null,
    };
  }

  async getPendingTripEarnings(
    user: JWTPayload,
  ): Promise<DriverPendingPayoutTrip[]> {
    const driver = await this.getCurrentDriver(user);
    if (!driver || !driver.isActive || driver.deletedAt) {
      return [];
    }

    const earnings = await db.query.earning.findMany({
      where: and(
        eq(earning.driverId, driver.driverId),
        eq(earning.status, "pending_trip_completion"),
      ),
      orderBy: [desc(earning.tripDate), desc(earning.createdAt)],
    });

    const groupedByTrip = new Map<string, DriverPendingPayoutTripRow>();

    for (const item of earnings) {
      const existing = groupedByTrip.get(item.tripId);
      if (existing) {
        existing.pendingAmountMinor += item.netAmountMinor;
        continue;
      }

      groupedByTrip.set(item.tripId, {
        tripId: item.tripId,
        routeId: item.routeId,
        tripDate: item.tripDate,
        pickupTitle: item.pickupTitle,
        dropoffTitle: item.dropoffTitle,
        pendingAmountMinor: item.netAmountMinor,
        currency: item.currency,
      });
    }

    return Array.from(groupedByTrip.values())
      .map((item) => ({
        ...item,
        tripDate:
          item.tripDate instanceof Date
            ? item.tripDate.toISOString()
            : new Date(item.tripDate).toISOString(),
      }))
      .sort(
        (left, right) =>
          new Date(right.tripDate).getTime() -
          new Date(left.tripDate).getTime(),
      );
  }

  async getHistory(
    user: JWTPayload,
    query: PayoutHistoryQuery,
  ): Promise<DriverPayoutHistoryItem[]> {
    const driver = await this.getCurrentDriver(user);
    if (!driver || !driver.isActive || driver.deletedAt) {
      return [];
    }

    const clauses = [eq(payout.driverId, driver.driverId)];

    if (query.status) {
      clauses.push(eq(payout.status, query.status));
    }

    if (query.cursor) {
      clauses.push(lt(payout.createdAt, new Date(query.cursor)));
    }

    const rows = await db.query.payout.findMany({
      where: and(...clauses),
      orderBy: [desc(payout.createdAt)],
      limit: Math.min(query.limit || 20, 100),
    });

    return rows.map(
      (row): DriverPayoutHistoryItem => ({
        id: row.id,
        driverId: row.driverId,
        reference: row.reference,
        amountMinor: row.amountMinor,
        koraFeeAmount: row.koraFeeAmount,
        currency: row.currency,
        earningsCount: row.earningsCount,
        status: row.status === "pending" ? "processing" : row.status,
        failureCode: row.failureCode,
        failureReason: row.failureReason,
        nextRetryAt: row.nextRetryAt,
        initiatedAt: row.initiatedAt,
        settledAt: row.settledAt,
        failedAt: row.failedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        recipientId: row.recipientId,
      }),
    );
  }

  async getSummary(
    user: JWTPayload,
    week: string,
  ): Promise<DriverPayoutSummary> {
    const driver = await this.getCurrentDriver(user);
    const weekStart = new Date(week);

    if (Number.isNaN(weekStart.getTime())) {
      throw createServiceError("week must be a valid ISO date", 400);
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    if (!driver || !driver.isActive || driver.deletedAt) {
      return {
        weekStart: weekStart.toISOString().slice(0, 10),
        currency: "NGN",
        days: Array.from({ length: 7 }, (_, index) => {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + index);
          return {
            date: date.toISOString().slice(0, 10),
            totalPaidAmountMinor: 0,
            payoutsCount: 0,
          };
        }),
      };
    }

    const payouts = await db.query.payout.findMany({
      where: and(
        eq(payout.driverId, driver.driverId),
        eq(payout.status, "success"),
        sql`${payout.settledAt} >= ${weekStart} and ${payout.settledAt} < ${weekEnd}`,
      ),
      orderBy: [desc(payout.settledAt)],
    });

    const byDate = new Map<string, DriverPayoutSummaryDay>();

    for (let index = 0; index < 7; index += 1) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      byDate.set(key, {
        date: key,
        totalPaidAmountMinor: 0,
        payoutsCount: 0,
      });
    }

    payouts.forEach((entry) => {
      const key = (entry.settledAt || entry.createdAt)
        .toISOString()
        .slice(0, 10);
      const current = byDate.get(key);
      if (!current) {
        return;
      }

      current.totalPaidAmountMinor += entry.amountMinor;
      current.payoutsCount += 1;
    });

    return {
      weekStart: weekStart.toISOString().slice(0, 10),
      currency: driver.currency,
      days: Array.from(byDate.values()),
    };
  }

  async resolveBankAccount(input: {
    bankCode: string;
    accountNumber: string;
    currency: string;
  }): Promise<ResolveBankAccountResponse> {
    const resolved = await this.koraClient.resolveAccountNumber(
      input.bankCode,
      input.accountNumber,
      input.currency,
    );

    return {
      accountName: resolved.data.account_name,
      bankName: resolved.data.bank_name,
      bankCode: resolved.data.bank_code,
    };
  }

  async processWebhook(input: {
    signature?: string;
    rawBody?: Buffer;
    event: KoraPayoutWebhookPayload;
  }) {
    const signatureValid = this.config.koraWebhookSecret
      ? verifyKoraWebhookSignature({
          rawBody: input.rawBody,
          signature: input.signature,
          secret: this.config.koraWebhookSecret,
        })
      : false;

    const [webhookRecord] = await db
      .insert(payoutWebhook)
      .values({
        eventType: input.event.event,
        reference: input.event.data.reference || null,
        signatureValid,
        payload: input.event,
      })
      .returning();

    if (!signatureValid) {
      return { processed: false, signatureValid };
    }

    const reference = input.event.data.reference;
    if (!reference) {
      await this.markWebhookProcessed(webhookRecord.id);
      return { processed: false, signatureValid };
    }

    const attempt = await this.getPayoutAttemptByReference(reference);
    if (!attempt) {
      await this.markWebhookProcessed(webhookRecord.id);
      return { processed: false, signatureValid };
    }

    const payoutRecord = await db.query.payout.findFirst({
      where: eq(payout.id, attempt.payoutId),
    });

    if (!payoutRecord) {
      await this.markWebhookProcessed(webhookRecord.id);
      return { processed: false, signatureValid };
    }

    if (input.event.event === "transfer.success") {
      if (
        payoutRecord.status === "permanent_failed" ||
        payoutRecord.status === "success" ||
        attempt.status === "settled"
      ) {
        await this.markWebhookProcessed(webhookRecord.id);
        return { processed: true, signatureValid };
      }

      await this.settlePayoutAttempt(
        payoutRecord,
        attempt,
        input.event,
        this.parseMajorCurrencyToMinor(input.event.data.fee),
      );

      await this.markWebhookProcessed(webhookRecord.id);
      return { processed: true, signatureValid };
    }

    if (input.event.event === "transfer.failed") {
      if (
        payoutRecord.status === "success" ||
        payoutRecord.status === "permanent_failed" ||
        attempt.status === "settled" ||
        attempt.status === "failed"
      ) {
        await this.markWebhookProcessed(webhookRecord.id);
        return { processed: true, signatureValid };
      }

      const failureReason = this.getWebhookFailureReason(input.event);

      await db
        .update(payoutAttempt)
        .set({
          status: "failed",
          failureReason,
          rawWebhook: input.event,
        })
        .where(eq(payoutAttempt.id, attempt.id));

      if (failureReason === KORA_ERROR_CODES.INSUFFICIENT_BALANCE) {
        await this.scheduleRetry(payoutRecord, failureReason);
      } else if (
        this.isRetryableWebhookFailure(failureReason) &&
        this.canRetry(payoutRecord.retryCount)
      ) {
        await this.scheduleRetry(payoutRecord, "API_ERROR");
      } else {
        await this.finalizePermanentFailure(
          payoutRecord,
          failureReason,
          input.event,
          true,
        );
      }

      await this.markWebhookProcessed(webhookRecord.id);
      return { processed: true, signatureValid };
    }

    logger.warn("payout.unsupported_webhook_event", {
      event_name: input.event.event,
    });
    await this.markWebhookProcessed(webhookRecord.id);
    return { processed: false, signatureValid };
  }

  private async getOrCreatePayout(
    earningRecord: EarningRecord,
  ): Promise<PayoutRecord> {
    const existingPayout = await db.query.payout.findFirst({
      where: eq(payout.earningId, earningRecord.id),
    });

    if (existingPayout) {
      if (earningRecord.payoutId !== existingPayout.id) {
        await db
          .update(earning)
          .set({
            payoutId: existingPayout.id,
            updatedAt: new Date(),
          })
          .where(eq(earning.id, earningRecord.id));
      }

      return existingPayout;
    }

    const [createdPayout] = await db
      .insert(payout)
      .values({
        driverId: earningRecord.driverId,
        recipientId: earningRecord.driverId,
        earningId: earningRecord.id,
        reference: this.buildPayoutReference(),
        amountMinor: earningRecord.netAmountMinor,
        currency: earningRecord.currency || "NGN",
        earningsCount: 1,
        status: "processing",
      })
      .onConflictDoNothing({
        target: payout.earningId,
      })
      .returning();

    const payoutRecord =
      createdPayout ||
      (await db.query.payout.findFirst({
        where: eq(payout.earningId, earningRecord.id),
      }));

    if (!payoutRecord) {
      throw new Error(
        `Failed to create or load payout for earning ${earningRecord.id}`,
      );
    }

    await db
      .update(earning)
      .set({
        payoutId: payoutRecord.id,
        updatedAt: new Date(),
      })
      .where(eq(earning.id, earningRecord.id));

    return payoutRecord;
  }

  private async processPayoutAttempt(
    payoutRecord: PayoutRecord,
    driver: ActiveDriverPayoutProfile,
  ): Promise<void> {
    const attemptNumber = payoutRecord.retryCount + 1;
    const reference = `${payoutRecord.reference}_attempt_${attemptNumber}`;

    if (attemptNumber > 1) {
      const previousAttempt = await this.getPayoutAttempt(
        payoutRecord.id,
        attemptNumber - 1,
      );

      if (previousAttempt?.status === "settled") {
        return;
      }

      if (previousAttempt) {
        const outcome = await this.verifyAttemptWithProvider(
          payoutRecord,
          previousAttempt,
        );

        if (outcome === "settled") {
          return;
        }

        if (outcome !== "failed") {
          if (this.canRetry(payoutRecord.retryCount)) {
            await this.scheduleVerificationRetry(
              payoutRecord,
              outcome === "processing"
                ? "PAYOUT_AWAITING_CONFIRMATION"
                : "PAYOUT_VERIFICATION_PENDING",
            );
            return;
          }

          const reason =
            outcome === "processing"
              ? "PAYOUT_AWAITING_CONFIRMATION"
              : "PAYOUT_VERIFICATION_PENDING";
          await this.finalizePermanentFailure(payoutRecord, reason, null);
          throw new Error(`PERMANENT_FAILURE:${reason}`);
        }
      }
    }

    const existingAttempt = await this.getPayoutAttempt(
      payoutRecord.id,
      attemptNumber,
    );

    if (existingAttempt?.status === "settled") {
      return;
    }

    if (existingAttempt) {
      if (
        existingAttempt.status === "pending" &&
        payoutRecord.status === "processing"
      ) {
        return;
      }

      if (existingAttempt.status === "pending_verification") {
        const outcome = await this.verifyAttemptWithProvider(
          payoutRecord,
          existingAttempt,
        );

        if (outcome === "settled") {
          return;
        }

        if (outcome !== "failed") {
          if (this.canRetry(payoutRecord.retryCount)) {
            await this.scheduleVerificationRetry(
              payoutRecord,
              outcome === "processing"
                ? "PAYOUT_AWAITING_CONFIRMATION"
                : "PAYOUT_VERIFICATION_PENDING",
            );
            return;
          }

          const reason =
            outcome === "processing"
              ? "PAYOUT_AWAITING_CONFIRMATION"
              : "PAYOUT_VERIFICATION_PENDING";
          await this.finalizePermanentFailure(payoutRecord, reason, null);
          throw new Error(`PERMANENT_FAILURE:${reason}`);
        }
      }
    }

    if (!existingAttempt) {
      await db.insert(payoutAttempt).values({
        payoutId: payoutRecord.id,
        attemptNumber,
        koraReference: reference,
        status: "pending",
      });
    }

    try {
      const result = await this.koraClient.initiatePayout({
        reference,
        amount: payoutRecord.amountMinor / 100,
        currency: payoutRecord.currency,
        bankCode: driver.bankCode,
        accountNumber: driver.accountNumber,
        accountName:
          driver.accountName || `${driver.firstName} ${driver.lastName}`,
        customerEmail: driver.email,
        narration: `Driver payout ${reference}`,
      });

      await db
        .update(payout)
        .set({
          status: "processing",
          providerTransferCode: result.data.reference,
          initiatedAt: new Date(),
          nextRetryAt: null,
          failureCode: null,
          failureReason: null,
          rawInitiateResponse: result.raw,
          updatedAt: new Date(),
        })
        .where(eq(payout.id, payoutRecord.id));

      if (payoutRecord.earningId) {
        await db
          .update(earning)
          .set({
            status: "processing",
            payoutId: payoutRecord.id,
            updatedAt: new Date(),
          })
          .where(eq(earning.id, payoutRecord.earningId));
      }
    } catch (error: any) {
      sentryServer.captureException(error, driver.driverId, {
        action: "processPayoutAttempt_initiatePayout",
        values: {
          reference,
          payoutId: payoutRecord.id,
          driverId: driver.driverId,
        },
      });
      const errorCode = error?.koraErrorCode as string | undefined;
      const failureReason = error?.message || "Payout initiation failed";
      const shouldVerify = this.shouldVerifyAmbiguousInitiationError(
        errorCode,
        error,
      );

      await db
        .update(payoutAttempt)
        .set({
          status: shouldVerify ? "pending_verification" : "failed",
          failureReason,
        })
        .where(
          and(
            eq(payoutAttempt.payoutId, payoutRecord.id),
            eq(payoutAttempt.attemptNumber, attemptNumber),
          ),
        );

      if (errorCode === KORA_ERROR_CODES.INSUFFICIENT_BALANCE) {
        await this.scheduleRetry(payoutRecord, errorCode);
        return;
      }

      if (errorCode && isFatalKoraError(errorCode)) {
        await this.finalizePermanentFailure(payoutRecord, errorCode, error);
        throw new Error(`PERMANENT_FAILURE:${errorCode}`);
      }

      if (shouldVerify) {
        const attempt = await this.getPayoutAttempt(payoutRecord.id, attemptNumber);
        if (!attempt) {
          throw error;
        }

        const outcome = await this.verifyAttemptWithProvider(payoutRecord, attempt);

        if (outcome === "settled") {
          return;
        }

        if (outcome === "failed") {
          if (this.canRetry(payoutRecord.retryCount)) {
            await this.scheduleRetry(payoutRecord, "API_ERROR");
            return;
          }

          await this.finalizePermanentFailure(
            payoutRecord,
            "MAX_RETRIES_EXCEEDED",
            error,
          );
          throw new Error("PERMANENT_FAILURE:MAX_RETRIES_EXCEEDED");
        }

        const retryReason =
          outcome === "processing"
            ? "PAYOUT_AWAITING_CONFIRMATION"
            : "PAYOUT_VERIFICATION_PENDING";

        if (this.canRetry(payoutRecord.retryCount)) {
          await this.scheduleVerificationRetry(payoutRecord, retryReason);
          return;
        }

        await this.finalizePermanentFailure(payoutRecord, retryReason, error);
        throw new Error(`PERMANENT_FAILURE:${retryReason}`);
      }

      if (
        errorCode &&
        isRetryableKoraError(errorCode) &&
        this.canRetry(payoutRecord.retryCount)
      ) {
        await this.scheduleRetry(payoutRecord, "API_ERROR");
        return;
      }

      const reason = errorCode || "MAX_RETRIES_EXCEEDED";
      await this.finalizePermanentFailure(payoutRecord, reason, error);
      throw new Error(`PERMANENT_FAILURE:${reason}`);
    }
  }

  private async scheduleRetry(
    payoutRecord: PayoutRecord,
    reason: string,
  ): Promise<void> {
    if (!payoutRecord.earningId) {
      throw new Error("Cannot schedule payout retry without earningId");
    }

    const delayMs =
      reason === KORA_ERROR_CODES.INSUFFICIENT_BALANCE
        ? this.config.insufficientBalanceRetryDelayMs
        : this.config.payoutRetryDelaysMs[
            Math.min(
              payoutRecord.retryCount,
              this.config.payoutRetryDelaysMs.length - 1,
            )
          ];

    const nextRetryAt = new Date(Date.now() + delayMs);

    await db
      .update(payout)
      .set({
        status: "failed",
        retryCount: payoutRecord.retryCount + 1,
        nextRetryAt,
        failureCode: reason,
        failureReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(payout.id, payoutRecord.id));

    await db
      .update(earning)
      .set({
        status: "processing",
        payoutId: payoutRecord.id,
        updatedAt: new Date(),
      })
      .where(eq(earning.id, payoutRecord.earningId));

    await boss.sendAfter(
      "process-payout",
      { earningId: payoutRecord.earningId },
      {
        singletonKey: payoutRecord.earningId,
        retryLimit: 0,
      },
      delayMs / 1000,
    );
  }

  private async scheduleVerificationRetry(
    payoutRecord: PayoutRecord,
    reason: string,
  ): Promise<void> {
    if (!payoutRecord.earningId) {
      throw new Error(
        "Cannot schedule payout verification retry without earningId",
      );
    }

    const delayMs =
      this.config.payoutRetryDelaysMs[
        Math.min(
          payoutRecord.retryCount,
          this.config.payoutRetryDelaysMs.length - 1,
        )
      ];
    const nextRetryAt = new Date(Date.now() + delayMs);

    await db
      .update(payout)
      .set({
        status: "processing",
        retryCount: payoutRecord.retryCount + 1,
        nextRetryAt,
        failureCode: reason,
        failureReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(payout.id, payoutRecord.id));

    await db
      .update(earning)
      .set({
        status: "processing",
        payoutId: payoutRecord.id,
        updatedAt: new Date(),
      })
      .where(eq(earning.id, payoutRecord.earningId));

    await boss.sendAfter(
      "process-payout",
      { earningId: payoutRecord.earningId },
      {
        singletonKey: payoutRecord.earningId,
        retryLimit: 0,
      },
      delayMs / 1000,
    );
  }

  private async finalizePermanentFailure(
    payoutRecord: PayoutRecord,
    reason: string,
    rawPayload: unknown,
    emitEvent: boolean = false,
  ): Promise<PayoutRecord> {
    const alreadyPermanent = payoutRecord.status === "permanent_failed";
    const [updatedPayout] = await db
      .update(payout)
      .set({
        status: "permanent_failed",
        failureCode: reason,
        failureReason: reason,
        nextRetryAt: null,
        failedAt: new Date(),
        rawFinalStatusResponse: rawPayload,
        updatedAt: new Date(),
      })
      .where(eq(payout.id, payoutRecord.id))
      .returning();

    if (payoutRecord.earningId) {
      await db
        .update(earning)
        .set({
          status: "manual_review",
          payoutId: payoutRecord.id,
          updatedAt: new Date(),
        })
        .where(eq(earning.id, payoutRecord.earningId));
    }

    if (emitEvent && !alreadyPermanent) {
      await this.emitFailureEvent(updatedPayout);
    }

    return updatedPayout;
  }

  private async emitFailureEvent(payoutRecord: PayoutRecord): Promise<void> {
    const recipient = await db.query.payoutRecipient.findFirst({
      where: eq(payoutRecipient.id, payoutRecord.recipientId),
    });

    await emitPayoutFailed({
      payoutId: payoutRecord.id,
      driverId: payoutRecord.driverId,
      driverEmail: payoutRecord.driverEmail || "",
      driverName: recipient?.accountName || null,
      reference: payoutRecord.reference,
      amountMinor: payoutRecord.amountMinor,
      koraFeeAmount: payoutRecord.koraFeeAmount || 0,
      currency: payoutRecord.currency,
      failureReason: payoutRecord.failureReason || null,
      bankName: recipient?.bankName || "",
      accountLast4: recipient?.accountNumberLast4 || "",
    });
  }

  private async getPayoutAttempt(
    payoutId: string,
    attemptNumber: number,
  ): Promise<PayoutAttemptRecord | undefined> {
    return db.query.payoutAttempt.findFirst({
      where: and(
        eq(payoutAttempt.payoutId, payoutId),
        eq(payoutAttempt.attemptNumber, attemptNumber),
      ),
    });
  }

  private async getPayoutAttemptByReference(
    reference: string,
  ): Promise<PayoutAttemptRecord | undefined> {
    return db.query.payoutAttempt.findFirst({
      where: eq(payoutAttempt.koraReference, reference),
    });
  }

  private async markWebhookProcessed(webhookId: string): Promise<void> {
    await db
      .update(payoutWebhook)
      .set({ processedAt: new Date() })
      .where(eq(payoutWebhook.id, webhookId));
  }

  private buildPayoutReference() {
    return `DX-PO-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  private buildFingerprint(profile: ActiveDriverPayoutProfile) {
    return createHash("sha256")
      .update(
        [
          profile.bankCode,
          profile.bankName,
          profile.accountNumber,
          profile.accountName,
          profile.currency,
        ].join("|"),
      )
      .digest("hex");
  }

  private async ensureRecipient(
    driverId: string,
    profile: ActiveDriverPayoutProfile,
  ) {
    const fingerprint = this.buildFingerprint(profile);
    const existingRecipient = await db.query.payoutRecipient.findFirst({
      where: eq(payoutRecipient.driverId, driverId),
    });

    if (
      existingRecipient &&
      existingRecipient.detailsFingerprint === fingerprint &&
      existingRecipient.status === "active"
    ) {
      return existingRecipient;
    }

    const resolved = await this.koraClient.resolveAccountNumber(
      profile.bankCode,
      profile.accountNumber,
      profile.currency,
    );

    const payload = {
      driverId,
      provider: "kora" as const,
      recipientCode: resolved.data.account_number,
      providerRecipientId: resolved.data.bank_code,
      bankCode: profile.bankCode,
      bankName: resolved.data.bank_name,
      accountName: profile.accountName,
      accountNumberLast4: profile.accountNumber.slice(-4),
      detailsFingerprint: fingerprint,
      status: "active" as const,
      rawResponse: resolved.raw,
      updatedAt: new Date(),
    };

    if (existingRecipient) {
      const [updatedRecipient] = await db
        .update(payoutRecipient)
        .set(payload)
        .where(eq(payoutRecipient.id, existingRecipient.id))
        .returning();

      return updatedRecipient;
    }

    const [createdRecipient] = await db
      .insert(payoutRecipient)
      .values(payload)
      .returning();

    return createdRecipient;
  }

  private parseMajorCurrencyToMinor(value: number | string): number {
    if (typeof value === "number") {
      return Math.round(value * 100);
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }

  private getWebhookFailureReason(event: KoraPayoutWebhookPayload): string {
    const message = (event.data.message || "").trim();
    if (message.toLowerCase().includes("insufficient")) {
      return KORA_ERROR_CODES.INSUFFICIENT_BALANCE;
    }
    return message || "Transfer failed";
  }

  private isRetryableWebhookFailure(message: string): boolean {
    const normalized = message.toLowerCase();
    return WEBHOOK_RETRYABLE_PATTERNS.some((pattern) =>
      normalized.includes(pattern),
    );
  }

  private canRetry(retryCount: number): boolean {
    return retryCount < this.config.payoutRetryDelaysMs.length;
  }

  private async hasConsumedEvent(eventId: string) {
    const existing = await db.query.consumedEvent.findFirst({
      where: eq(consumedEvent.eventId, eventId),
    });

    return Boolean(existing);
  }

  private async markEventConsumed(eventId: string, topic: string) {
    await db.insert(consumedEvent).values({
      eventId,
      topic,
    });
  }

  private async getCurrentDriver(user: JWTPayload) {
    return db.query.driverPayoutProfile.findFirst({
      where: eq(driverPayoutProfile.userId, user.userId),
    });
  }

  private async getDriverPayoutProfile(
    driverId: string,
  ): Promise<DriverPayoutProfileRecord | undefined> {
    return db.query.driverPayoutProfile.findFirst({
      where: eq(driverPayoutProfile.driverId, driverId),
    });
  }

  private shouldVerifyAmbiguousInitiationError(
    errorCode: string | undefined,
    error: unknown,
  ): boolean {
    if (errorCode) {
      return false;
    }

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

  private async verifyAttemptWithProvider(
    payoutRecord: PayoutRecord,
    attempt: PayoutAttemptRecord,
  ): Promise<AttemptVerificationOutcome> {
    try {
      const verification = await this.koraClient.findPayoutByReference(
        attempt.koraReference,
      );
      const verifiedPayout = verification.data;

      if (!verifiedPayout) {
        await db
          .update(payoutAttempt)
          .set({
            status: "pending_verification",
            failureReason: "Payout verification pending",
            rawWebhook: verification.raw,
          })
          .where(eq(payoutAttempt.id, attempt.id));
        return "unknown";
      }

      const providerStatus = verifiedPayout.status.toLowerCase();

      if (providerStatus === "success") {
        await this.settlePayoutAttempt(
          payoutRecord,
          attempt,
          verification.raw,
          this.parseMajorCurrencyToMinor(verifiedPayout.fee || 0),
        );
        return "settled";
      }

      if (providerStatus === "failed") {
        await db
          .update(payoutAttempt)
          .set({
            status: "failed",
            failureReason:
              verifiedPayout.message || attempt.failureReason || "Transfer failed",
            rawWebhook: verification.raw,
          })
          .where(eq(payoutAttempt.id, attempt.id));
        return "failed";
      }

      if (providerStatus === "processing" || providerStatus === "pending") {
        await db
          .update(payoutAttempt)
          .set({
            status: "pending_verification",
            failureReason: "Awaiting payout confirmation",
            rawWebhook: verification.raw,
          })
          .where(eq(payoutAttempt.id, attempt.id));

        await db
          .update(payout)
          .set({
            status: "processing",
            nextRetryAt: null,
            failureCode: null,
            failureReason: null,
            updatedAt: new Date(),
          })
          .where(eq(payout.id, payoutRecord.id));

        return "processing";
      }

      await db
        .update(payoutAttempt)
        .set({
          status: "pending_verification",
          failureReason:
            verifiedPayout.message || "Payout verification pending",
          rawWebhook: verification.raw,
        })
        .where(eq(payoutAttempt.id, attempt.id));
      return "unknown";
    } catch (error) {
      logger.warn("payout.verification_lookup_failed", {
        payout_id: payoutRecord.id,
        reference: attempt.koraReference,
        error: error instanceof Error ? error.message : String(error),
      });

      await db
        .update(payoutAttempt)
        .set({
          status: "pending_verification",
          failureReason:
            error instanceof Error
              ? error.message
              : "Payout verification pending",
        })
        .where(eq(payoutAttempt.id, attempt.id));

      return "unknown";
    }
  }

  private async settlePayoutAttempt(
    payoutRecord: PayoutRecord,
    attempt: PayoutAttemptRecord,
    rawPayload: unknown,
    koraFeeAmount: number,
  ): Promise<void> {
    if (
      attempt.status === "settled" ||
      payoutRecord.status === "success"
    ) {
      return;
    }

    const settledAt = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(payoutAttempt)
        .set({
          status: "settled",
          koraFeeAmount,
          settledAt,
          rawWebhook: rawPayload,
        })
        .where(eq(payoutAttempt.id, attempt.id));

      await tx
        .update(payout)
        .set({
          status: "success",
          koraFeeAmount,
          settledAt,
          nextRetryAt: null,
          failureCode: null,
          failureReason: null,
          rawFinalStatusResponse: rawPayload,
          updatedAt: new Date(),
        })
        .where(eq(payout.id, payoutRecord.id));

      if (payoutRecord.earningId) {
        await tx
          .update(earning)
          .set({
            status: "paid",
            payoutId: payoutRecord.id,
            updatedAt: new Date(),
          })
          .where(eq(earning.id, payoutRecord.earningId));
      }
    });

    await emitPayoutCompleted({
      payoutId: payoutRecord.id,
      driverId: payoutRecord.driverId,
      reference: payoutRecord.reference,
      amountMinor: payoutRecord.amountMinor,
      currency: payoutRecord.currency,
    });

    logger.info(PayoutMetrics.SETTLED, {
      payout_id: payoutRecord.id,
      earning_id: payoutRecord.earningId,
      driver_id: payoutRecord.driverId,
      amount_minor: payoutRecord.amountMinor,
      reference: attempt.koraReference,
      fee_minor: koraFeeAmount,
    });
  }

  private toActiveDriverPayoutProfile(
    profile: DriverPayoutProfileRecord,
  ): ActiveDriverPayoutProfile {
    return {
      ...profile,
      email: profile.email as string,
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      bankName: profile.bankName as string,
      bankCode: profile.bankCode as string,
      accountNumber: profile.accountNumber as string,
      accountName: profile.accountName as string,
      bankVerificationStatus: "active",
      deletedAt: null,
      isActive: true,
    };
  }
}
