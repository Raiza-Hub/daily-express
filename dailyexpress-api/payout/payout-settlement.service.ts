import { eq } from "drizzle-orm";
import { db } from "../db/connection";
import { payout as payoutTable } from "../db/index";
import { koraClient } from "../payment/kora.client";
import { logger } from "../utils/logger";
import type { PayoutRecord } from "../db/index";

export type PayoutVerificationOutcome =
  | "settled"
  | "failed"
  | "processing"
  | "unknown";

export class PayoutSettlementService {
  private readonly kora = koraClient;

  async verifyWithProvider(
    payout: PayoutRecord,
  ): Promise<PayoutVerificationOutcome> {
    const lookup = await this.kora.findPayoutByReference(payout.reference);

    switch (lookup.kind) {
      case "notFound":
        return "failed";
      case "error":
        logger.warn("payout.verify_lookup_failed", {
          reference: payout.reference,
          error:
            lookup.error instanceof Error
              ? lookup.error.message
              : String(lookup.error),
        });
        return "unknown";
      case "found":
        switch (lookup.payout.status.toLowerCase()) {
          case "success":
            await this.finalizePayout(payout);
            return "settled";
          case "failed":
            return "failed";
          default:
            return "processing";
        }
    }
  }

  async finalizePayout(payout: PayoutRecord) {
    // Prevents double finalization: re-reading payout under lock ensures the
    // second caller sees the terminal status and leaves it alone.
    await db.transaction(async (tx) => {
      const [lockedPayout] = await tx
        .select()
        .from(payoutTable)
        .where(eq(payoutTable.id, payout.id))
        .for("update")
        .limit(1);
      if (
        !lockedPayout ||
        lockedPayout.status === "successful" ||
        lockedPayout.status === "failed"
      ) {
        return;
      }

      await tx
        .update(payoutTable)
        .set({
          status: "successful",
          updatedAt: new Date(),
        })
        .where(eq(payoutTable.id, lockedPayout.id));
    });
  }
}

export const payoutSettlementService = new PayoutSettlementService();
