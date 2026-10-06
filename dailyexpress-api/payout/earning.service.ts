import { type DbTransaction } from "../db/connection";
import { PayoutRepository, payoutRepository } from "./payout.repository";

type PayoutTransaction = DbTransaction;

export class EarningService {
  constructor(private repo: PayoutRepository) {}

  async createEarning(
    tx: PayoutTransaction,
    input: {
      tripId: string;
      amount: number;
      currency: string;
    },
  ) {
    await this.repo.insertEarning(tx, {
      tripId: input.tripId,
      amount: input.amount,
      currency: input.currency,
      updatedAt: new Date(),
    });
  }
}

export const earningService = new EarningService(payoutRepository);
