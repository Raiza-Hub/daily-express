import { type DbTransaction } from "../db/connection";
import { PayoutRepository, payoutRepository } from "./payout.repository";
import { jobService } from "../workers/job.service";

type PayoutTransaction = DbTransaction;

export class EarningService {
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
    const completedAt = input.completedAt || new Date();
    await this.repo.updateEarningsByTrip(
      tx,
      input.tripId,
      "pending_trip_completion",
      {
        status: "available",
        availableAt: completedAt,
        updatedAt: new Date(),
      },
    );

    const unsettledEarning = await this.repo.hasUnsettledEarnings(
      tx,
      input.tripId,
    );
    if (unsettledEarning) {
      await jobService.enqueuePayout(tx, { tripId: input.tripId });
    }
  }
}

export const earningService = new EarningService(payoutRepository);
