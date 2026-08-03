import { and, desc, eq, gte, lt, or } from "drizzle-orm";
import type {
  DriverPayoutHistoryItem,
  JWTPayload,
  PayoutStatus,
} from "@shared/types";
import { getConfig } from "../config/index";
import { db } from "../db/connection";
import { driver, payout } from "../db/index";
import { PayoutRepository } from "./payout.repository";
import { EarningService } from "./earning.service";
import { PayoutSettlementService } from "./payout-settlement.service";
import { PayoutProcessorService } from "./payout-processor.service";
import { PayoutWebhookService } from "./payout-webhook.service";
import { PayoutNotificationService } from "./payout-notification.service";
import type { KoraPayoutWebhookPayload } from "../payment/payment.types";

type PayoutTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class PayoutService {
  private readonly config = getConfig();

  private readonly repo = new PayoutRepository();
  private readonly earningService = new EarningService(this.repo);
  private readonly settlementService = new PayoutSettlementService(this.repo);
  private readonly notificationService = new PayoutNotificationService(this.repo);
  private readonly processorService = new PayoutProcessorService(
    this.repo,
    this.settlementService,
    this.notificationService,
  );
  private readonly webhookService = new PayoutWebhookService(
    this.repo,
    this.settlementService,
    this.notificationService,
  );

  async createEarningForConfirmedBookingInTransaction(
    tx: PayoutTransaction,
    input: {
      bookingId: string;
      tripId: string;
      driverId: string;
      fareAmount: number;
      currency: string;
    },
  ) {
    return this.earningService.createEarning(tx, input);
  }

  async markTripCompletedInTransaction(
    tx: PayoutTransaction,
    input: { tripId: string; completedAt?: Date },
  ) {
    return this.earningService.completeTrip(tx, input);
  }

  async getHistory(
    user: JWTPayload,
    query: { limit?: number; cursor?: string; status?: PayoutStatus },
  ): Promise<{ payouts: DriverPayoutHistoryItem[]; nextCursor: string | null }> {
    const currentDriver = await this.getCurrentDriver(user);
    if (!currentDriver) return { payouts: [], nextCursor: null };

    const limit = this.normalizeLimit(query.limit);
    const clauses = [eq(payout.driverId, currentDriver.id)];
    if (query.status) clauses.push(eq(payout.status, query.status));
    if (query.cursor) {
      const [createdAtStr, id] = query.cursor.split("|");
      const cursorDate = new Date(createdAtStr);
      clauses.push(
        or(
          lt(payout.createdAt, cursorDate),
          and(eq(payout.createdAt, cursorDate), lt(payout.id, id!)),
        )!,
      );
    }

    const rows = await this.repo.findPayoutHistory(and(...clauses), limit + 1);

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      nextCursor = `${rows[limit].createdAt.toISOString()}|${rows[limit].id}`;
    }

    const payouts = rows.slice(0, limit).map((row) => ({
      id: row.id,
      driverId: row.driverId,
      reference: row.reference,
      amount: row.amount,
      currency: row.currency,
      tripId: row.tripId,
      status: row.status === "pending" ? "processing" : row.status,
      failureCode: row.failureCode,
      failureReason: row.failureReason,
      failedAt: row.failedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      recipientBankName: row.recipientBankName,
      recipientAccountLast4: row.recipientAccountLast4,
    }));

    return { payouts, nextCursor };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) return 20;
    return Math.max(1, Math.min(100, Math.floor(limit)));
  }

  async triggerPayout(tripId: string) {
    return this.processorService.processTripPayout(tripId);
  }

  async hasUnsettledEarnings(tripId: string) {
    return this.repo.hasUnsettledEarnings(db, tripId);
  }

  async processWebhook(input: {
    signature?: string;
    event: KoraPayoutWebhookPayload;
  }) {
    return this.webhookService.processWebhook(input);
  }

  private async getCurrentDriver(user: JWTPayload) {
    return db.query.driver.findFirst({
      where: eq(driver.userId, user.userId),
    });
  }
}

export const payoutService = new PayoutService();
