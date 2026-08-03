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
      driverId: string;
      fareAmount: number;
      currency: string;
    },
  ) {
    await this.repo.insertEarning(tx, {
      driverId: input.driverId,
      bookingId: input.bookingId,
      tripId: input.tripId,
      amount: input.fareAmount,
      currency: input.currency,
      status: "pending_trip_completion",
      updatedAt: new Date(),
    });
  }

  async completeTrip(
    tx: PayoutTransaction,
    input: { tripId: string; completedAt?: Date },
  ) {
    await this.repo.updateEarningsByTrip(
      tx,
      input.tripId,
      "pending_trip_completion",
      {
        status: "available",
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
