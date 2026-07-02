import { and, desc, eq, gte, lt } from "drizzle-orm";
import type {
  DriverPayoutBalance,
  DriverPayoutHistoryItem,
  DriverPayoutSummary,
  DriverPayoutSummaryDay,
  JWTPayload,
  PayoutStatus,
} from "@shared/types";
import { createServiceError } from "@shared/utils";
import { getConfig } from "../config/index";
import { db, type DbTransaction } from "../db/connection";
import { driver, payout, type PayoutRecord } from "../db/index";
import { payoutRepository } from "./payout.repository";
import { earningService } from "./earning.service";
import { payoutRecipientService } from "./payout-recipient.service";
import { payoutAttemptService } from "./payout-attempt.service";
import { payoutProcessorService } from "./payout-processor.service";
import { payoutWebhookService } from "./payout-webhook.service";
import { payoutNotificationService } from "./payout-notification.service";
import { formatDateKey } from "../utils/timezone";
import { addDaysToDateKey, getBusinessDayWindow } from "../utils/route";
import type { KoraPayoutWebhookPayload } from "../payment/payment.types";

type PayoutTransaction = DbTransaction;

export class PayoutService {
  private readonly config = getConfig();

  constructor(
    private repo = payoutRepository,
    private earningSvc = earningService,
    private recipientService = payoutRecipientService,
    private attemptService = payoutAttemptService,
    private notificationService = payoutNotificationService,
    private processorService = payoutProcessorService,
    private webhookService = payoutWebhookService,
  ) {}

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
  ) {
    return this.earningSvc.createEarning(tx, input);
  }

  async markTripCompletedInTransaction(
    tx: PayoutTransaction,
    input: { tripId: string; completedAt?: Date },
  ) {
    return this.earningSvc.completeTrip(tx, input);
  }

  async getBalance(user: JWTPayload): Promise<DriverPayoutBalance> {
    const currentDriver = await this.getCurrentDriver(user);
    if (!currentDriver) {
      return {
        pendingAmountMinor: 0,
        availableAmountMinor: 0,
        processingAmountMinor: 0,
        paidAmountMinor: 0,
        nextAutoPayoutAt: null,
      };
    }

    const earnings = await this.repo.findDriverEarnings(currentDriver.id);
    const totals = earnings.reduce(
      (acc, item) => {
        if (item.status === "pending_trip_completion") {
          acc.pendingAmountMinor += item.netAmountMinor;
        } else if (item.status === "available") {
          acc.availableAmountMinor += item.netAmountMinor;
        } else if (item.status === "paid") {
          acc.paidAmountMinor += item.netAmountMinor;
        } else if (item.status === "processing") {
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
    if (!currentDriver) return [];

    const rows = await this.repo.findPayoutHistory(currentDriver.id, query);

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

  async getWeeklySummary(
    user: JWTPayload,
    week: string,
  ): Promise<DriverPayoutSummary> {
    const currentDriver = await this.getCurrentDriver(user);
    let weekWindow: ReturnType<typeof getBusinessDayWindow>;
    let weekEndWindow: ReturnType<typeof getBusinessDayWindow>;
    try {
      weekWindow = getBusinessDayWindow(week);
      weekEndWindow = getBusinessDayWindow(
        addDaysToDateKey(weekWindow.dateKey, 7),
      );
    } catch {
      throw createServiceError("week must be a valid ISO date", 400);
    }
    const days = this.emptySummaryDays(weekWindow.dateKey);

    if (!currentDriver) {
      return {
        weekStart: weekWindow.dateKey,
        currency: "NGN",
        days,
      };
    }

    const rows = await this.repo.findWeeklyPayouts(
      currentDriver.id,
      weekWindow.start,
      weekEndWindow.start,
    );

    const byDate = new Map(days.map((day) => [day.date, day]));
    for (const row of rows) {
      const key = formatDateKey(row.settledAt || row.createdAt);
      const current = byDate.get(key);
      if (!current) continue;
      current.totalPaidAmountMinor += row.amountMinor;
      current.payoutsCount += 1;
    }

    return {
      weekStart: weekWindow.dateKey,
      currency: currentDriver.currency,
      days: Array.from(byDate.values()),
    };
  }

  async triggerPayout(earningId: string) {
    return this.processorService.processEarningPayout(earningId);
  }

  async processWebhook(input: {
    signature?: string;
    event: KoraPayoutWebhookPayload;
  }) {
    return this.webhookService.processWebhook(input);
  }

  scheduleRetry(payoutRecord: PayoutRecord, reason: string) {
    return this.processorService.scheduleRetry(payoutRecord, reason);
  }

  canRetry(retryCount: number) {
    return this.processorService.canRetry(retryCount);
  }

  private async getCurrentDriver(user: JWTPayload) {
    return db.query.driver.findFirst({
      where: eq(driver.userId, user.userId),
    });
  }

  private emptySummaryDays(weekStartDateKey: string): DriverPayoutSummaryDay[] {
    return Array.from({ length: 7 }, (_, index) => ({
      date: addDaysToDateKey(weekStartDateKey, index),
      totalPaidAmountMinor: 0,
      payoutsCount: 0,
    }));
  }
}

export const payoutService = new PayoutService();
