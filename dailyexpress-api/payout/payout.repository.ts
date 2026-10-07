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
          amount: sql`${earning.amount} + excluded.amount`,
          updatedAt: new Date(),
        },
      });
  }

  async findTripPayoutEarningByTripId(tripId: string) {
    const row = await db.query.earning.findFirst({
      where: eq(earning.tripId, tripId),
      with: { trip: { columns: { driverId: true, status: true } } },
    });

    // earning_trip_unique_idx ⇒ at most one earning per trip; PK lookup on
    // trip, so no fan-out. The 'completed' filter moves here because drizzle's
    // relational `where` cannot reference a joined table's columns.
    if (!row || row.trip?.status !== "completed") return null;

    // Check if an active (non-failed) payout already exists for this trip
    const activePayout = await db.query.payout.findFirst({
      where: and(
        eq(payout.tripId, tripId),
        inArray(payout.status, ["pending", "successful"]),
      ),
    });
    if (activePayout) return null;

    return { earning: row, driverId: row.trip.driverId };
  }

  findPayoutByReference(reference: string) {
    return db.query.payout.findFirst({
      where: eq(payout.reference, reference),
    });
  }

  async findLatestPayoutByTripId(tripId: string) {
    return db.query.payout.findFirst({
      where: eq(payout.tripId, tripId),
      orderBy: (fields, { desc }) => [desc(fields.createdAt)],
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
