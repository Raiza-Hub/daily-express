import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/connection";
import {
  driver,
  earning,
  payout,
} from "../db/index";
import type { DbTransaction } from "../db/connection";

type PayoutTransaction = DbTransaction;

export class PayoutRepository {

  findEarningById(id: string) {
    return db.query.earning.findFirst({
      where: eq(earning.id, id),
    });
  }

  findEarningsByTripId(tripId: string) {
    return db.query.earning.findMany({
      where: eq(earning.tripId, tripId),
    });
  }

  insertEarning(
    tx: PayoutTransaction,
    values: typeof earning.$inferInsert,
  ) {
    return tx
      .insert(earning)
      .values(values)
      .onConflictDoUpdate({
        target: earning.tripId,
        set: {
          amount: sql`excluded.amount`,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Find the earning for a trip that is eligible for payout.
   * Returns null if no earning exists or if a non-failed payout already exists
   * (meaning the trip is already paid or payment is in progress).
   */
  async findTripPayoutEarningByTripId(tripId: string) {
    const earningRow = await db.query.earning.findFirst({
      where: eq(earning.tripId, tripId),
    });
    if (!earningRow) return null;

    // Check if an active (non-failed) payout already exists for this trip
    const activePayout = await db.query.payout.findFirst({
      where: and(
        eq(payout.tripId, tripId),
        inArray(payout.status, ["pending", "successful"]),
      ),
    });
    if (activePayout) return null;

    return earningRow;
  }

  findPayoutById(id: string) {
    return db.query.payout.findFirst({
      where: eq(payout.id, id),
    });
  }

  findPayoutByReference(reference: string) {
    return db.query.payout.findFirst({
      where: eq(payout.reference, reference),
    });
  }

  insertPayout(tx: PayoutTransaction, values: typeof payout.$inferInsert) {
    return tx
      .insert(payout)
      .values(values)
      .onConflictDoNothing({
        target: payout.tripId,
        where: sql`${payout.tripId} is not null and ${payout.status} <> 'failed'`,
      })
      .returning();
  }

  updatePayout(
    tx: PayoutTransaction,
    id: string,
    fields: Partial<typeof payout.$inferInsert>,
  ) {
    return tx
      .update(payout)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(payout.id, id));
  }


  findDriverById(driverId: string) {
    return db.query.driver.findFirst({
      where: eq(driver.id, driverId),
    });
  }

  findPayoutHistory(
    whereClause: ReturnType<typeof and>,
    limit: number,
  ) {
    return db.query.payout.findMany({
      where: whereClause,
      orderBy: [desc(payout.createdAt), desc(payout.id)],
      limit,
    });
  }

}

export const payoutRepository = new PayoutRepository();
