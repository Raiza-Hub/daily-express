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
          status: values.status,
          updatedAt: new Date(),
        },
      });
  }

  updateEarningStatus(
    tx: PayoutTransaction,
    id: string,
    fields: Partial<typeof earning.$inferInsert>,
  ) {
    return tx
      .update(earning)
      .set(fields)
      .where(eq(earning.id, id));
  }

  updateEarningsByTrip(
    tx: PayoutTransaction,
    tripId: string,
    currentStatus: "pending_trip_completion" | "available",
    fields: Partial<typeof earning.$inferInsert>,
  ) {
    return tx
      .update(earning)
      .set(fields)
      .where(
        and(
          eq(earning.tripId, tripId),
          eq(earning.status, currentStatus),
        ),
      )
      .returning({
        id: earning.id,
        driverId: earning.driverId,
        amount: earning.amount,
      });
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

  findTripPayoutEarningByTripId(tripId: string) {
    return db.query.earning.findFirst({
      where: and(
        eq(earning.tripId, tripId),
        inArray(earning.status, ["available", "processing"]),
      ),
      orderBy: [desc(earning.createdAt), desc(earning.id)],
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
