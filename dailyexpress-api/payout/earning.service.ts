import { and, eq } from "drizzle-orm";
import { sentryServer } from "@shared/sentry";
import { logger } from "../utils/logger";
import { db, type DbTransaction } from "../db/connection";
import { earning } from "../db/index";
import { PayoutRepository, payoutRepository } from "./payout.repository";
import { driverService as sharedDriverService } from "../driver/driver.service";
import { notificationService as sharedNotificationService } from "../notification/notification.service";
import { jobService } from "../workers/job.service";
import type { DriverNotification } from "@shared/types";

type PayoutTransaction = DbTransaction;

export class EarningService {
  private readonly driverService = sharedDriverService;
  private readonly notificationService = sharedNotificationService;

  constructor(private repo: PayoutRepository) {}

  async createEarning(
    tx: PayoutTransaction,
    input: {
      bookingId: string;
      tripId: string;
      routeId: string;
      driverId: string;
      tripDate: Date | string;
      pickupTitle: string;
      dropoffTitle: string;
      fareAmount: number;
      currency: string;
      sourceEventId: string;
    },
  ) {
    await this.repo.insertEarning(tx, {
      driverId: input.driverId,
      bookingId: input.bookingId,
      tripId: input.tripId,
      routeId: input.routeId,
      tripDate: new Date(input.tripDate),
      pickupTitle: input.pickupTitle,
      dropoffTitle: input.dropoffTitle,
      grossAmount: input.fareAmount,
      feeAmount: 0,
      netAmount: input.fareAmount,
      currency: input.currency,
      status: "pending_trip_completion",
      sourceEventId: input.sourceEventId,
      updatedAt: new Date(),
    });
  }

  async completeTrip(
    tx: PayoutTransaction,
    input: { tripId: string; completedAt?: Date },
  ) {
    const pendingNotifications: DriverNotification[] = [];
    const reconciliation = await this.repo.reconcileTripEarnings(tx, input.tripId);

    if (!reconciliation.isReconciled) {
      const manualReviewEarnings = await this.repo.updateEarningsByTrip(
        tx,
        input.tripId,
        "pending_trip_completion",
        {
          status: "manual_review",
          updatedAt: new Date(),
        },
      );

      for (const entry of manualReviewEarnings) {
        await this.driverService.adjustPaymentCountersForStatusChange(tx, {
          driverId: entry.driverId,
          amount: entry.netAmount,
          previousStatus: "pending_trip_completion",
          nextStatus: "manual_review",
        });
      }

      if (reconciliation.driverId) {
        const notificationRecord =
          await this.alertReconciliationFailure(
            tx,
            input.tripId,
            reconciliation,
          );
        pendingNotifications.push(notificationRecord);

        logger.warn("payout.trip_reconciliation_failed", {
          tripId: input.tripId,
          driverId: reconciliation.driverId,
          bookingCount: reconciliation.bookingCount,
          bookingAmount: reconciliation.bookingAmount,
          earningCount: reconciliation.earningCount,
          earningAmount: reconciliation.earningAmount,
          amountDifference:
            reconciliation.bookingAmount -
            reconciliation.earningAmount,
        });

        sentryServer.captureException(
          new Error("Trip payout reconciliation failed"),
          reconciliation.driverId ?? "system",
          {
            action: "payout_trip_reconciliation_failed",
            tripId: input.tripId,
            driverId: reconciliation.driverId,
            bookingCount: reconciliation.bookingCount,
            bookingAmount: reconciliation.bookingAmount,
            earningCount: reconciliation.earningCount,
            earningAmount: reconciliation.earningAmount,
            amountDifference:
              reconciliation.bookingAmount -
              reconciliation.earningAmount,
          },
        );
      }

      return { pendingNotifications };
    }

    const releasedEarnings = await this.repo.updateEarningsByTrip(
      tx,
      input.tripId,
      "pending_trip_completion",
      {
        status: "available",
        availableAt: input.completedAt || new Date(),
        updatedAt: new Date(),
      },
    );

    for (const entry of releasedEarnings) {
      await jobService.enqueuePayout(tx, { earningId: entry.id });
    }

    return { pendingNotifications };
  }

  private async alertReconciliationFailure(
    tx: PayoutTransaction,
    tripId: string,
    reconciliation: { driverId: string | null; bookingCount: number; bookingAmount: number; earningCount: number; earningAmount: number },
  ) {
    if (!reconciliation.driverId) {
      throw new Error("Cannot notify reconciliation failure without driverId");
    }

    return this.notificationService.createForDriverInTransaction(
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
          bookingAmount: reconciliation.bookingAmount,
          earningCount: reconciliation.earningCount,
          earningAmount: reconciliation.earningAmount,
          amountDifference:
            reconciliation.bookingAmount -
            reconciliation.earningAmount,
        },
        occurredAt: new Date(),
      },
    );
  }
}

export const earningService = new EarningService(payoutRepository);
