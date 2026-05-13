import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, lt, notInArray, sql } from "drizzle-orm";
import type {
  DriverNotification,
  DriverPayoutBalance,
  DriverPayoutHistoryItem,
  DriverPayoutSummary,
  DriverPayoutSummaryDay,
  JWTPayload,
  PayoutStatus,
} from "@shared/types";
import { createServiceError } from "@shared/utils";
import { sentryServer } from "@shared/sentry";
import { renderEmail, getEmailSubject } from "@repo/email";
import { getConfig } from "../config/index";
import { db } from "../db/connection";
import {
  booking,
  driver,
  earning,
  payout,
  payoutAttempt,
  payoutRecipient,
  payoutWebhook,
  trip,
} from "../db/index";
import { logger } from "../utils/logger";
import { DriverService } from "../driver/driverService";
import { NotificationService } from "../notification/notificationService";
import { publishNotificationCreated } from "../notification/realtime";
import { KoraClient } from "../payment/kora.client";
import type {
  KoraPayoutHistoryItem,
  KoraPayoutWebhookPayload,
} from "../payment/payment.types";
import { jobService } from "../workers/jobService";
import {
  formatAmountMinor,
  isFatalKoraError,
  isRetryableKoraError,
  parseDelayString,
  parseMajorCurrencyToMinor,
} from "../utils/payout";

type PayoutTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type EarningRecord = typeof earning.$inferSelect;
type PayoutRecord = typeof payout.$inferSelect;
type PayoutAttemptRecord = typeof payoutAttempt.$inferSelect;
type DriverRecord = typeof driver.$inferSelect;

type ActivePayoutDriver = DriverRecord & {
  bankVerificationStatus: "active";
};
type TripEarningsReconciliation = {
  reconciles: boolean;
  driverId: string | null;
  bookingCount: number;
  bookingAmountMinor: number;
  earningCount: number;
  earningAmountMinor: number;
};

type AttemptVerificationOutcome =
  | "settled"
  | "failed"
  | "processing"
  | "unknown";

const KORA_ERROR_CODES = {
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  INVALID_ACCOUNT: "INVALID_ACCOUNT",
  BANK_PROCESSING_ERROR: "BANK_PROCESSING_ERROR",
  DUPLICATE_REFERENCE: "DUPLICATE_REFERENCE",
} as const;

const FATAL_KORA_ERRORS = new Set<string>([
  KORA_ERROR_CODES.INVALID_ACCOUNT,
  KORA_ERROR_CODES.DUPLICATE_REFERENCE,
]);
const RETRYABLE_KORA_ERRORS = new Set<string>([
  KORA_ERROR_CODES.BANK_PROCESSING_ERROR,
]);
const WEBHOOK_RETRYABLE_PATTERNS = [
  "timeout",
  "bank processing",
  "processing error",
  "service unavailable",
  "unable to complete",
  "destination bank is not available",
];
const AMBIGUOUS_KORA_HTTP_STATUSES = new Set([500, 502, 503, 504]);

const koraClient = new KoraClient();
const driverService = new DriverService();
const notificationService = new NotificationService();

export class PayoutService {
  private readonly config = getConfig();
  private readonly payoutRetryDelaysMs = parseDelayString(
    this.config.PAYOUT_RETRY_DELAYS_MS,
  );

  async createEarningForConfirmedBookingInTransaction(
    tx: PayoutTransaction,
    input: {
      bookingId: string;
      tripId: string;
      routeId: string;
      driverId: string;
      tripDate: Date | string;
      pickupTitle: string;
      dropoffTitle: string;
      fareAmountMinor: number;
      currency: string;
      sourceEventId: string;
    },
  ): Promise<void> {
    await tx
      .insert(earning)
      .values({
        driverId: input.driverId,
        bookingId: input.bookingId,
        tripId: input.tripId,
        routeId: input.routeId,
        tripDate: new Date(input.tripDate),
        pickupTitle: input.pickupTitle,
        dropoffTitle: input.dropoffTitle,
        grossAmountMinor: input.fareAmountMinor,
        feeAmountMinor: 0,
        netAmountMinor: input.fareAmountMinor,
        currency: input.currency,
        status: "pending_trip_completion",
        sourceEventId: input.sourceEventId,
        updatedAt: new Date(),
      })
      .onConflictDoNothing({ target: earning.bookingId });
  }

  async markTripCompletedInTransaction(
    tx: PayoutTransaction,
    input: { tripId: string; completedAt?: Date },
  ): Promise<{ pendingNotifications: DriverNotification[] }> {
    const pendingNotifications: DriverNotification[] = [];
    const reconciliation = await this.reconcileTripEarningsInTransaction(
      tx,
      input.tripId,
    );
    if (!reconciliation.reconciles) {
      await tx
        .update(earning)
        .set({
          status: "manual_review",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(earning.tripId, input.tripId),
            eq(earning.status, "pending_trip_completion"),
          ),
        );
      if (reconciliation.driverId) {
        const notificationRecord =
          await this.createTripReconciliationFailedNotification(
            tx,
            input.tripId,
            reconciliation,
          );
        pendingNotifications.push(notificationRecord);
      }
      return { pendingNotifications };
    }

    const releasedEarnings = await tx
      .update(earning)
      .set({
        status: "available",
        availableAt: input.completedAt || new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(earning.tripId, input.tripId),
          eq(earning.status, "pending_trip_completion"),
        ),
      )
      .returning({ id: earning.id });

    for (const entry of releasedEarnings) {
      await jobService.enqueuePayout(tx, { earningId: entry.id });
    }

    return { pendingNotifications };
  }

  private async reconcileTripEarningsInTransaction(
    tx: PayoutTransaction,
    tripId: string,
  ): Promise<TripEarningsReconciliation> {
    const tripRecord = await tx.query.trip.findFirst({
      where: eq(trip.id, tripId),
    });

    const [bookingTotals] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        amountMinor: sql<number>`coalesce(sum(${booking.fareAmount} * 100), 0)::bigint`,
      })
      .from(booking)
      .where(
        and(
          eq(booking.tripId, tripId),
          inArray(booking.status, ["confirmed", "completed"]),
          notInArray(booking.paymentStatus, ["failed", "cancelled", "expired"]),
        ),
      );

    const [earningTotals] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        amountMinor: sql<number>`coalesce(sum(${earning.grossAmountMinor}), 0)::bigint`,
      })
      .from(earning)
      .where(
        and(
          eq(earning.tripId, tripId),
          notInArray(earning.status, ["cancelled", "manual_review"]),
        ),
      );

    const bookingCount = bookingTotals?.count ?? 0;
    const bookingAmountMinor = bookingTotals?.amountMinor ?? 0;
    const earningCount = earningTotals?.count ?? 0;
    const earningAmountMinor = earningTotals?.amountMinor ?? 0;
    const reconciles =
      bookingCount === earningCount && bookingAmountMinor === earningAmountMinor;

    if (!reconciles) {
      const amountDifferenceMinor = bookingAmountMinor - earningAmountMinor;
      logger.warn("payout.trip_reconciliation_failed", {
        tripId,
        driverId: tripRecord?.driverId ?? null,
        bookingCount,
        bookingAmountMinor,
        earningCount,
        earningAmountMinor,
        amountDifferenceMinor,
      });
      sentryServer.captureException(
        new Error("Trip payout reconciliation failed"),
        tripRecord?.driverId ?? "system",
        {
          action: "payout_trip_reconciliation_failed",
          tripId,
          driverId: tripRecord?.driverId ?? null,
          bookingCount,
          bookingAmountMinor,
          earningCount,
          earningAmountMinor,
          amountDifferenceMinor,
        },
      );
    }

    return {
      reconciles,
      driverId: tripRecord?.driverId ?? null,
      bookingCount,
      bookingAmountMinor,
      earningCount,
      earningAmountMinor,
    };
  }

  private async createTripReconciliationFailedNotification(
    tx: PayoutTransaction,
    tripId: string,
    reconciliation: TripEarningsReconciliation,
  ) {
    if (!reconciliation.driverId) {
      throw new Error("Cannot notify reconciliation failure without driverId");
    }

    return notificationService.createForDriverInTransaction(
      tx,
      reconciliation.driverId,
      {
        notificationKey: `event:trip:${tripId}:payout-reconciliation-failed`,
        kind: "event",
        type: "payout_reconciliation_failed",
        title: "Trip payout needs review",
        message:
          "We found a mismatch between confirmed booking fares and payout earnings for this trip. Payout was paused for review.",
        href: "/payouts",
        tag: "Action needed",
        tone: "critical",
        metadata: {
          tripId,
          bookingCount: reconciliation.bookingCount,
          bookingAmountMinor: reconciliation.bookingAmountMinor,
          earningCount: reconciliation.earningCount,
          earningAmountMinor: reconciliation.earningAmountMinor,
          amountDifferenceMinor:
            reconciliation.bookingAmountMinor -
            reconciliation.earningAmountMinor,
        },
        occurredAt: new Date(),
      },
    );
  }

  async cancelBookingEarningInTransaction(
    tx: PayoutTransaction,
    bookingId: string,
  ): Promise<void> {
    const existing = await tx.query.earning.findFirst({
      where: eq(earning.bookingId, bookingId),
    });
    if (!existing) return;

    const nextStatus =
      existing.status === "paid" ? "manual_review" : "cancelled";
    await tx
      .update(earning)
      .set({
        status: nextStatus,
        payoutId: nextStatus === "cancelled" ? null : existing.payoutId,
        updatedAt: new Date(),
      })
      .where(eq(earning.id, existing.id));
  }

  async cancelTripEarningsInTransaction(
    tx: PayoutTransaction,
    tripId: string,
  ): Promise<void> {
    const tripEarnings = await tx.query.earning.findMany({
      where: eq(earning.tripId, tripId),
    });

    for (const entry of tripEarnings) {
      const nextStatus =
        entry.status === "paid" ? "manual_review" : "cancelled";
      await tx
        .update(earning)
        .set({
          status: nextStatus,
          payoutId: nextStatus === "cancelled" ? null : entry.payoutId,
          updatedAt: new Date(),
        })
        .where(eq(earning.id, entry.id));
    }
  }

  async getBalance(user: JWTPayload): Promise<DriverPayoutBalance> {
    const currentDriver = await this.getCurrentDriver(user);
    if (!currentDriver || !currentDriver.isActive) {
      return {
        pendingAmountMinor: 0,
        availableAmountMinor: 0,
        processingAmountMinor: 0,
        paidAmountMinor: 0,
        nextAutoPayoutAt: null,
      };
    }

    const earnings = await db.query.earning.findMany({
      where: eq(earning.driverId, currentDriver.id),
      columns: { status: true, netAmountMinor: true },
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

    return { ...totals, nextAutoPayoutAt: null };
  }

  async getHistory(
    user: JWTPayload,
    query: { limit?: number; cursor?: string; status?: PayoutStatus },
  ): Promise<DriverPayoutHistoryItem[]> {
    const currentDriver = await this.getCurrentDriver(user);
    if (!currentDriver || !currentDriver.isActive) {
      return [];
    }

    const clauses = [eq(payout.driverId, currentDriver.id)];
    if (query.status) clauses.push(eq(payout.status, query.status));
    if (query.cursor)
      clauses.push(lt(payout.createdAt, new Date(query.cursor)));

    const rows = await db.query.payout.findMany({
      where: and(...clauses),
      orderBy: [desc(payout.createdAt)],
      limit: Math.min(query.limit || 20, 100),
    });

    return rows.map((row) => ({
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
    }));
  }

  async getSummary(
    user: JWTPayload,
    week: string,
  ): Promise<DriverPayoutSummary> {
    const currentDriver = await this.getCurrentDriver(user);
    const weekStart = new Date(week);
    if (Number.isNaN(weekStart.getTime())) {
      throw createServiceError("week must be a valid ISO date", 400);
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const days = this.emptySummaryDays(weekStart);

    if (!currentDriver || !currentDriver.isActive) {
      return {
        weekStart: weekStart.toISOString().slice(0, 10),
        currency: "NGN",
        days,
      };
    }

    const rows = await db.query.payout.findMany({
      where: and(
        eq(payout.driverId, currentDriver.id),
        eq(payout.status, "success"),
        gte(payout.settledAt, weekStart),
        lt(payout.settledAt, weekEnd),
      ),
      orderBy: [desc(payout.settledAt)],
    });

    const byDate = new Map(days.map((day) => [day.date, day]));
    for (const row of rows) {
      const key = (row.settledAt || row.createdAt).toISOString().slice(0, 10);
      const current = byDate.get(key);
      if (!current) continue;
      current.totalPaidAmountMinor += row.amountMinor;
      current.payoutsCount += 1;
    }

    return {
      weekStart: weekStart.toISOString().slice(0, 10),
      currency: currentDriver.currency,
      days: Array.from(byDate.values()),
    };
  }

  async triggerPayout(earningId: string): Promise<void> {
    const earningRecord = await db.query.earning.findFirst({
      where: eq(earning.id, earningId),
    });

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
      await this.finalizePermanentFailure(
        payoutRecord,
        "DRIVER_PROFILE_INCOMPLETE",
        null,
        true,
      );
      return;
    }

    const recipient = await this.ensureRecipient(payoutDriver);
    if (payoutRecord.recipientId !== recipient.id) {
      [payoutRecord] = await db
        .update(payout)
        .set({
          recipientId: recipient.id,
          driverEmail: payoutDriver.email,
          updatedAt: new Date(),
        })
        .where(eq(payout.id, payoutRecord.id))
        .returning();
    }

    const balanceResult = await koraClient.getBalance();
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

    await this.processPayoutAttempt(payoutRecord, payoutDriver);
  }

  async processWebhook(input: {
    signature?: string;
    event: KoraPayoutWebhookPayload;
  }) {
    const signatureValid = koraClient.verifyWebhookSignature(
      input.event.data,
      input.signature,
    );

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
      await this.markWebhookProcessed(webhookRecord.id);
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
        parseMajorCurrencyToMinor(input.event.data.fee),
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

    await this.markWebhookProcessed(webhookRecord.id);
    return { processed: false, signatureValid };
  }

  private emptySummaryDays(weekStart: Date): DriverPayoutSummaryDay[] {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return {
        date: date.toISOString().slice(0, 10),
        totalPaidAmountMinor: 0,
        payoutsCount: 0,
      };
    });
  }

  private async getCurrentDriver(user: JWTPayload) {
    return db.query.driver.findFirst({
      where: eq(driver.userId, user.userId),
    });
  }

  private async getActivePayoutDriver(
    driverId: string,
  ): Promise<ActivePayoutDriver | null> {
    const record = await db.query.driver.findFirst({
      where: eq(driver.id, driverId),
    });

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

  private async getOrCreatePayout(
    earningRecord: EarningRecord,
  ): Promise<PayoutRecord> {
    return db.transaction(async (tx) => {
      const existingPayout = await tx.query.payout.findFirst({
        where: eq(payout.earningId, earningRecord.id),
      });

      if (existingPayout) {
        if (earningRecord.payoutId !== existingPayout.id) {
          await tx
            .update(earning)
            .set({ payoutId: existingPayout.id, updatedAt: new Date() })
            .where(eq(earning.id, earningRecord.id));
        }
        return existingPayout;
      }

      const [createdPayout] = await tx
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
        .onConflictDoNothing({ target: payout.earningId })
        .returning();

      const payoutRecord =
        createdPayout ||
        (await tx.query.payout.findFirst({
          where: eq(payout.earningId, earningRecord.id),
        }));
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

  private async ensureRecipient(payoutDriver: ActivePayoutDriver) {
    const fingerprint = this.buildFingerprint(payoutDriver);
    const existingRecipient = await db.query.payoutRecipient.findFirst({
      where: eq(payoutRecipient.driverId, payoutDriver.id),
    });

    if (
      existingRecipient &&
      existingRecipient.detailsFingerprint === fingerprint &&
      existingRecipient.status === "active"
    ) {
      return existingRecipient;
    }

    const payload = {
      driverId: payoutDriver.id,
      provider: "kora" as const,
      recipientCode: payoutDriver.accountNumber,
      providerRecipientId: payoutDriver.bankCode,
      bankCode: payoutDriver.bankCode,
      bankName: payoutDriver.bankName,
      accountName: payoutDriver.accountName,
      accountNumberLast4: payoutDriver.accountNumber.slice(-4),
      detailsFingerprint: fingerprint,
      status: "active" as const,
      rawResponse: {
        source: "driver.bank_verification",
        bankName: payoutDriver.bankName,
        bankCode: payoutDriver.bankCode,
        accountName: payoutDriver.accountName,
      },
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

  private async processPayoutAttempt(
    payoutRecord: PayoutRecord,
    payoutDriver: ActivePayoutDriver,
  ): Promise<void> {
    const attemptNumber = payoutRecord.retryCount + 1;
    const reference = `${payoutRecord.reference}_attempt_${attemptNumber}`;

    if (attemptNumber > 1) {
      const previousAttempt = await this.getPayoutAttempt(
        payoutRecord.id,
        attemptNumber - 1,
      );
      if (previousAttempt?.status === "settled") return;
      if (previousAttempt) {
        const outcome = await this.verifyAttemptWithProvider(
          payoutRecord,
          previousAttempt,
        );
        if (outcome === "settled") return;
        if (outcome !== "failed") {
          await this.handleVerificationRetryOutcome(payoutRecord, outcome);
          return;
        }
      }
    }

    const existingAttempt = await this.getPayoutAttempt(
      payoutRecord.id,
      attemptNumber,
    );
    if (existingAttempt?.status === "settled") return;
    if (
      existingAttempt?.status === "pending" &&
      payoutRecord.status === "processing"
    ) {
      return;
    }
    if (existingAttempt?.status === "pending_verification") {
      const outcome = await this.verifyAttemptWithProvider(
        payoutRecord,
        existingAttempt,
      );
      if (outcome === "settled") return;
      if (outcome !== "failed") {
        await this.handleVerificationRetryOutcome(payoutRecord, outcome);
        return;
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
      const result = await koraClient.initiatePayout({
        reference,
        amount: payoutRecord.amountMinor / 100,
        currency: payoutRecord.currency,
        bankCode: payoutDriver.bankCode,
        accountNumber: payoutDriver.accountNumber,
        accountName:
          payoutDriver.accountName ||
          `${payoutDriver.firstName} ${payoutDriver.lastName}`,
        customerEmail: payoutDriver.email,
        narration: `Driver payout ${reference}`,
      });

      await db.transaction(async (tx) => {
        await tx
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
          await tx
            .update(earning)
            .set({
              status: "processing",
              payoutId: payoutRecord.id,
              updatedAt: new Date(),
            })
            .where(eq(earning.id, payoutRecord.earningId));
        }
      });
    } catch (error: any) {
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
        await this.finalizePermanentFailure(
          payoutRecord,
          errorCode,
          error,
          true,
        );
        return;
      }
      if (shouldVerify) {
        const attempt = await this.getPayoutAttempt(
          payoutRecord.id,
          attemptNumber,
        );
        if (!attempt) throw error;
        const outcome = await this.verifyAttemptWithProvider(
          payoutRecord,
          attempt,
        );
        if (outcome === "settled") return;
        if (outcome === "failed" && this.canRetry(payoutRecord.retryCount)) {
          await this.scheduleRetry(payoutRecord, "API_ERROR");
          return;
        }
        await this.handleVerificationRetryOutcome(payoutRecord, outcome);
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

      await this.finalizePermanentFailure(
        payoutRecord,
        errorCode || "MAX_RETRIES_EXCEEDED",
        error,
        true,
      );
    }
  }

  private async handleVerificationRetryOutcome(
    payoutRecord: PayoutRecord,
    outcome: AttemptVerificationOutcome,
  ) {
    const reason =
      outcome === "processing"
        ? "PAYOUT_AWAITING_CONFIRMATION"
        : "PAYOUT_VERIFICATION_PENDING";
    if (this.canRetry(payoutRecord.retryCount)) {
      await this.scheduleVerificationRetry(payoutRecord, reason);
      return;
    }
    await this.finalizePermanentFailure(payoutRecord, reason, null, true);
  }

  private async scheduleRetry(
    payoutRecord: PayoutRecord,
    reason: string,
  ): Promise<void> {
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

    await db.transaction(async (tx) => {
      await tx
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

      await tx
        .update(earning)
        .set({
          status: "processing",
          payoutId: payoutRecord.id,
          updatedAt: new Date(),
        })
        .where(eq(earning.id, earningId));

      await jobService.enqueuePayout(tx, { earningId }, nextRetryAt);
    });
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
    const earningId = payoutRecord.earningId;

    const delayMs =
      this.payoutRetryDelaysMs[
        Math.min(
          payoutRecord.retryCount,
          Math.max(this.payoutRetryDelaysMs.length - 1, 0),
        )
      ] || 60_000;
    const nextRetryAt = new Date(Date.now() + delayMs);

    await db.transaction(async (tx) => {
      await tx
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

      await tx
        .update(earning)
        .set({
          status: "processing",
          payoutId: payoutRecord.id,
          updatedAt: new Date(),
        })
        .where(eq(earning.id, earningId));

      await jobService.enqueuePayout(tx, { earningId }, nextRetryAt);
    });
  }

  private async finalizePermanentFailure(
    payoutRecord: PayoutRecord,
    reason: string,
    rawPayload: unknown,
    shouldNotify = false,
  ): Promise<PayoutRecord> {
    const [recipientRecord, driverRecord] = await Promise.all([
      payoutRecord.driverEmail
        ? db.query.payoutRecipient.findFirst({
            where: eq(payoutRecipient.id, payoutRecord.recipientId),
          })
        : null,
      payoutRecord.driverEmail
        ? db.query.driver.findFirst({
            where: eq(driver.id, payoutRecord.driverId),
          })
        : null,
    ]);

    const driverName = driverRecord
      ? `${driverRecord.firstName} ${driverRecord.lastName}`.trim()
      : null;

    let emailHtml: string | null = null;
    let emailSubject: string | null = null;
    if (payoutRecord.driverEmail && recipientRecord) {
      const propsJson = JSON.stringify({
        frontendUrl: this.config.FRONTEND_URL,
        driverName,
        driverEmail: payoutRecord.driverEmail,
        amountMinor: payoutRecord.amountMinor,
        koraFeeAmount: payoutRecord.koraFeeAmount ?? 0,
        reference: payoutRecord.reference,
        failureReason: reason,
        bankName: recipientRecord.bankName,
        accountLast4: recipientRecord.accountNumberLast4,
      });
      emailHtml = await renderEmail("PayoutFailedEmail", propsJson);
      emailSubject = getEmailSubject("PayoutFailedEmail", propsJson);
    }

    let notificationRecord: DriverNotification | null = null;
    const [updatedPayout] = await db.transaction(async (tx) => {
      const [updated] = await tx
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
        await tx
          .update(earning)
          .set({
            status: "manual_review",
            payoutId: payoutRecord.id,
            updatedAt: new Date(),
          })
          .where(eq(earning.id, payoutRecord.earningId));
      }

      if (emailHtml && emailSubject && payoutRecord.driverEmail) {
        await jobService.enqueueEmail(tx, "email.payout_failed", {
          to: payoutRecord.driverEmail,
          subject: emailSubject,
          html: emailHtml,
        });
      }

      if (shouldNotify && payoutRecord.status !== "permanent_failed") {
        notificationRecord = await this.createPayoutFailedNotification(
          tx,
          updated,
        );
      }

      return [updated];
    });

    if (notificationRecord) {
      await publishNotificationCreated(notificationRecord);
    }

    return updatedPayout;
  }

  private async verifyAttemptWithProvider(
    payoutRecord: PayoutRecord,
    attempt: PayoutAttemptRecord,
  ): Promise<AttemptVerificationOutcome> {
    try {
      const verification = await koraClient.findPayoutByReference(
        attempt.koraReference,
      );
      const verifiedPayout = verification.data as KoraPayoutHistoryItem | null;

      if (!verifiedPayout) {
        await this.markAttemptPendingVerification(
          attempt.id,
          "Payout verification pending",
          verification.raw,
        );
        return "unknown";
      }

      const providerStatus = verifiedPayout.status.toLowerCase();
      if (providerStatus === "success") {
        await this.settlePayoutAttempt(
          payoutRecord,
          attempt,
          verification.raw,
          parseMajorCurrencyToMinor(verifiedPayout.fee || 0),
        );
        return "settled";
      }
      if (providerStatus === "failed") {
        await db
          .update(payoutAttempt)
          .set({
            status: "failed",
            failureReason:
              verifiedPayout.message ||
              attempt.failureReason ||
              "Transfer failed",
            rawWebhook: verification.raw,
          })
          .where(eq(payoutAttempt.id, attempt.id));
        return "failed";
      }
      if (providerStatus === "processing" || providerStatus === "pending") {
        await this.markAttemptPendingVerification(
          attempt.id,
          "Awaiting payout confirmation",
          verification.raw,
        );
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

      await this.markAttemptPendingVerification(
        attempt.id,
        verifiedPayout.message || "Payout verification pending",
        verification.raw,
      );
      return "unknown";
    } catch (error) {
      await this.markAttemptPendingVerification(
        attempt.id,
        error instanceof Error ? error.message : "Payout verification pending",
      );
      return "unknown";
    }
  }

  private async markAttemptPendingVerification(
    attemptId: string,
    failureReason: string,
    rawWebhook?: unknown,
  ) {
    await db
      .update(payoutAttempt)
      .set({
        status: "pending_verification",
        failureReason,
        ...(rawWebhook === undefined ? {} : { rawWebhook }),
      })
      .where(eq(payoutAttempt.id, attemptId));
  }

  private async settlePayoutAttempt(
    payoutRecord: PayoutRecord,
    attempt: PayoutAttemptRecord,
    rawPayload: unknown,
    koraFeeAmount: number,
  ): Promise<void> {
    if (attempt.status === "settled" || payoutRecord.status === "success")
      return;

    let notificationRecord: DriverNotification | null = null;
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

      const [updatedPayout] = await tx
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
        .where(eq(payout.id, payoutRecord.id))
        .returning();

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

      await driverService.recordPayoutCompleted(tx, {
        driverId: payoutRecord.driverId,
        amountMinor: payoutRecord.amountMinor,
      });

      notificationRecord = await this.createPayoutCompletedNotification(
        tx,
        updatedPayout,
      );
    });

    if (notificationRecord) {
      await publishNotificationCreated(notificationRecord);
    }
  }

  private async createPayoutCompletedNotification(
    tx: PayoutTransaction,
    payoutRecord: PayoutRecord,
  ) {
    return notificationService.createForDriverInTransaction(
      tx,
      payoutRecord.driverId,
      {
        notificationKey: `event:payout:${payoutRecord.id}:completed`,
        kind: "event",
        type: "payout_completed",
        title: "Payout sent successfully",
        message: `${formatAmountMinor(
          payoutRecord.amountMinor,
          payoutRecord.currency,
        )} was transferred to your account.`,
        href: "/payouts",
        tag: "Paid",
        tone: "positive",
        metadata: {
          payoutId: payoutRecord.id,
          reference: payoutRecord.reference,
        },
        occurredAt: new Date(),
      },
    );
  }

  private async createPayoutFailedNotification(
    tx: PayoutTransaction,
    payoutRecord: PayoutRecord,
  ) {
    return notificationService.createForDriverInTransaction(
      tx,
      payoutRecord.driverId,
      {
        notificationKey: `event:payout:${payoutRecord.id}:failed`,
        kind: "event",
        type: "payout_failed",
        title: "A payout needs review",
        message:
          payoutRecord.failureReason ||
          `${formatAmountMinor(
            payoutRecord.amountMinor,
            payoutRecord.currency,
          )} could not be transferred successfully.`,
        href: "/payouts",
        tag: "Action needed",
        tone: "critical",
        metadata: {
          payoutId: payoutRecord.id,
          reference: payoutRecord.reference,
        },
        occurredAt: new Date(),
      },
    );
  }

  private async getPayoutAttempt(payoutId: string, attemptNumber: number) {
    return db.query.payoutAttempt.findFirst({
      where: and(
        eq(payoutAttempt.payoutId, payoutId),
        eq(payoutAttempt.attemptNumber, attemptNumber),
      ),
    });
  }

  private async getPayoutAttemptByReference(reference: string) {
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

  private buildFingerprint(record: ActivePayoutDriver) {
    return createHash("sha256")
      .update(
        [
          record.bankCode,
          record.bankName,
          record.accountNumber,
          record.accountName,
          record.currency,
        ].join("|"),
      )
      .digest("hex");
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
    return retryCount < this.payoutRetryDelaysMs.length;
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
