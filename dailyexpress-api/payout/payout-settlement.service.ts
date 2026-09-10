import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/connection";
import { earning, payout as payoutTable } from "../db/index";
import { koraClient } from "../payment/kora.client";
import { driverService as sharedDriverService } from "../driver/driver.service";
import type { KoraPayoutHistoryItem } from "../payment/payment.types";
import type { PayoutRecord } from "../db/index";

export type PayoutVerificationOutcome =
  | "settled"
  | "failed"
  | "processing"
  | "unknown";

export class PayoutSettlementService {
  private readonly kora = koraClient;
  private readonly driverService = sharedDriverService;

  async verifyWithProvider(
    payout: PayoutRecord,
  ): Promise<PayoutVerificationOutcome> {
    try {
      const verifiedPayout = await this.kora.findPayoutByReference(
        payout.reference,
      ) as KoraPayoutHistoryItem | null;

      if (!verifiedPayout) {
        // Reference not found at the provider: the transfer was never
        // created, so it is safe to treat this as failed.
        return "failed";
      }

      const providerStatus = verifiedPayout.status.toLowerCase();
      if (providerStatus === "success") {
        await this.finalizePayout(payout);
        return "settled";
      }

      if (providerStatus === "failed") {
        return "failed";
      }

      return "processing";
    } catch (error) {
      // Lookup API itself failed: we cannot determine the transfer's state,
      // so leave the payout processing and let the provider webhook resolve it.
      return "unknown";
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
        lockedPayout.status === "success" ||
        lockedPayout.status === "failed"
      ) {
        return;
      }

      await tx
        .update(payoutTable)
        .set({
          status: "success",
          failureCode: null,
          failureReason: null,
          updatedAt: new Date(),
        })
        .where(eq(payoutTable.id, lockedPayout.id));

      const tripEarnings = payout.tripId
        ? await tx.query.earning.findMany({
            where: and(
              eq(earning.tripId, payout.tripId),
              inArray(earning.status, ["available", "processing"]),
            ),
          })
        : [];

      if (payout.tripId) {
        await tx
          .update(earning)
          .set({
            status: "paid",
            payoutId: payout.id,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(earning.tripId, payout.tripId),
              inArray(earning.status, ["available", "processing"]),
            ),
          );
      }

      if (tripEarnings.length > 0) {
        const totalAmount = tripEarnings.reduce(
          (sum, entry) => sum + entry.amount,
          0,
        );
        await this.driverService.adjustPaymentCountersForStatusChange(tx, {
          driverId: payout.driverId,
          amount: totalAmount,
          previousStatus: "processing",
          nextStatus: "paid",
        });
      }

      await this.driverService.recordPayoutForDriver(tx, {
        driverId: payout.driverId,
        amount: payout.amount,
      });
    });
  }
}

export const payoutSettlementService = new PayoutSettlementService();
