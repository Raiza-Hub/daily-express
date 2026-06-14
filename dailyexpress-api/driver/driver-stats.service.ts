import { eq, sql, type SQL } from "drizzle-orm";
import { driverStats } from "../db/index";
import { db } from "../db/connection";

type DriverTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type EarningStatus =
  | "pending_trip_completion"
  | "available"
  | "processing"
  | "paid"
  | "cancelled"
  | "manual_review";

type RouteStatus = "inactive" | "pending" | "active";

const PENDING_PAYMENT_STATUSES = new Set<EarningStatus>([
  "pending_trip_completion",
  "available",
  "processing",
]);

export class DriverStatsService {
  async recordNewBookingForDriver(
    tx: DriverTransaction,
    input: {
      driverId: string;
      fareAmountMinor: number;
    },
  ): Promise<void> {
    await tx
      .update(driverStats)
      .set({
        pendingPayments: sql`${driverStats.pendingPayments} + ${input.fareAmountMinor}`,
        totalPassengers: sql`${driverStats.totalPassengers} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, input.driverId));
  }

  async decrementStatsForCancelledBooking(
    tx: DriverTransaction,
    input: {
      driverId: string;
      amountMinor: number;
      previousEarningStatus?: EarningStatus | null;
    },
  ): Promise<void> {
    const pendingDelta =
      input.previousEarningStatus &&
      PENDING_PAYMENT_STATUSES.has(input.previousEarningStatus)
        ? input.amountMinor
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
      amountMinor: number;
    },
  ): Promise<void> {
    await tx
      .update(driverStats)
      .set({
        totalEarnings: sql`${driverStats.totalEarnings} + ${input.amountMinor}`,
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, input.driverId));
  }

  async adjustPaymentCountersForStatusChange(
    tx: DriverTransaction,
    input: {
      driverId: string;
      amountMinor: number;
      previousStatus: EarningStatus;
      nextStatus: EarningStatus;
    },
  ): Promise<void> {
    const wasPendingPayment = PENDING_PAYMENT_STATUSES.has(input.previousStatus);
    const isPendingPayment = PENDING_PAYMENT_STATUSES.has(input.nextStatus);
    const wasInReview = input.previousStatus === "manual_review";
    const isInReview = input.nextStatus === "manual_review";

    if (wasPendingPayment === isPendingPayment && wasInReview === isInReview) {
      return;
    }

    const updates: Record<string, SQL | Date> = { updatedAt: new Date() };

    if (wasPendingPayment !== isPendingPayment) {
      updates.pendingPayments = wasPendingPayment
        ? sql`GREATEST(${driverStats.pendingPayments} - ${input.amountMinor}, 0)`
        : sql`${driverStats.pendingPayments} + ${input.amountMinor}`;
    }

    if (wasInReview !== isInReview) {
      updates.inReviewPayments = wasInReview
        ? sql`GREATEST(${driverStats.inReviewPayments} - ${input.amountMinor}, 0)`
        : sql`${driverStats.inReviewPayments} + ${input.amountMinor}`;
    }

    await tx
      .update(driverStats)
      .set(updates)
      .where(eq(driverStats.driverId, input.driverId));
  }

  async recordRouteStatusChange(
    tx: DriverTransaction,
    input: {
      driverId: string;
      previousStatus?: RouteStatus | null;
      nextStatus?: RouteStatus | null;
    },
  ): Promise<void> {
    const wasActive = input.previousStatus === "active";
    const isActive = input.nextStatus === "active";
    if (wasActive === isActive) {
      return;
    }

    await tx
      .update(driverStats)
      .set({
        activeRoutes: isActive
          ? sql`${driverStats.activeRoutes} + 1`
          : sql`GREATEST(${driverStats.activeRoutes} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, input.driverId));
  }
}
