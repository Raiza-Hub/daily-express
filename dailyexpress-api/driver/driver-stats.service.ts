import { eq, sql, type SQL } from "drizzle-orm";
import { driverStats } from "../db/index";
import { db } from "../db/connection";
import type { DbTransaction } from "../db/connection";

type DriverTransaction = DbTransaction;

type EarningStatus =
  | "pending_trip_completion"
  | "available"
  | "processing"
  | "paid"
  | "cancelled";

const PENDING_PAYMENT_STATUSES = new Set<EarningStatus>([
  "pending_trip_completion",
  "available",
  "processing",
]);

export class DriverStatsService {
  async decrementStatsForCancelledBooking(
    tx: DriverTransaction,
    input: {
      driverId: string;
      amount: number;
      previousEarningStatus?: EarningStatus | null;
    },
  ): Promise<void> {
    const pendingDelta =
      input.previousEarningStatus &&
      PENDING_PAYMENT_STATUSES.has(input.previousEarningStatus)
        ? input.amount
        : 0;

    await tx
      .update(driverStats)
      .set({
        totalPassengers: sql`GREATEST(${driverStats.totalPassengers} - 1, 0)`,
        pendingPayments: sql`GREATEST(${driverStats.pendingPayments} - ${pendingDelta}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, input.driverId));
  }

  async recordPayoutForDriver(
    tx: DriverTransaction,
    input: {
      driverId: string;
      amount: number;
    },
  ): Promise<void> {
    await tx
      .update(driverStats)
      .set({
        totalEarnings: sql`${driverStats.totalEarnings} + ${input.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, input.driverId));
  }

  async adjustPaymentCountersForStatusChange(
    tx: DriverTransaction,
    input: {
      driverId: string;
      amount: number;
      previousStatus: EarningStatus;
      nextStatus: EarningStatus;
    },
  ): Promise<void> {
    const wasPendingPayment = PENDING_PAYMENT_STATUSES.has(input.previousStatus);
    const isPendingPayment = PENDING_PAYMENT_STATUSES.has(input.nextStatus);

    if (wasPendingPayment === isPendingPayment) {
      return;
    }

    const updates: Record<string, SQL | Date> = { updatedAt: new Date() };

    updates.pendingPayments = wasPendingPayment
      ? sql`GREATEST(${driverStats.pendingPayments} - ${input.amount}, 0)`
      : sql`${driverStats.pendingPayments} + ${input.amount}`;

    await tx
      .update(driverStats)
      .set(updates)
      .where(eq(driverStats.driverId, input.driverId));
  }
}

export const driverStatsService = new DriverStatsService();
