import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "../db/connection";
import {
  driver,
  earning,
  payout,
  type EarningRecord,
  type PayoutRecord,
  type DriverRecord,
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

  findEarningByBookingId(bookingId: string) {
    return db.query.earning.findFirst({
      where: eq(earning.bookingId, bookingId),
    });
  }

  insertEarning(
    tx: PayoutTransaction,
    values: typeof earning.$inferInsert,
  ) {
    return tx
      .insert(earning)
      .values(values)
      .onConflictDoNothing({ target: earning.bookingId });
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

  updateEarningByBookingId(
    tx: PayoutTransaction,
    bookingId: string,
    fields: Partial<typeof earning.$inferInsert>,
  ) {
    return tx
      .update(earning)
      .set(fields)
      .where(eq(earning.bookingId, bookingId));
  }

  findPayoutByTripId(tx: PayoutTransaction | typeof db, tripId: string) {
    return tx.query.payout.findFirst({
      where: eq(payout.tripId, tripId),
      orderBy: [desc(payout.createdAt), desc(payout.id)],
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

  findTripPayoutEarnings(tripId: string) {
    return db.query.earning.findMany({
      where: and(
        eq(earning.tripId, tripId),
        inArray(earning.status, ["available", "processing"]),
      ),
    });
  }

  hasUnsettledEarnings(tx: PayoutTransaction | typeof db, tripId: string) {
    return tx.query.earning.findFirst({
      where: and(
        eq(earning.tripId, tripId),
        inArray(earning.status, [
          "pending_trip_completion",
          "available",
          "processing",
        ]),
      ),
      columns: { id: true },
    });
  }

  insertPayout(tx: PayoutTransaction, values: typeof payout.$inferInsert) {
    return tx.insert(payout).values(values).returning();
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

  findDriverEarnings(driverId: string) {
    return db.query.earning.findMany({
      where: eq(earning.driverId, driverId),
      columns: { status: true, amount: true },
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

  findWeeklyPayouts(driverId: string, start: Date, end: Date) {
    return db.query.payout.findMany({
      where: and(
        eq(payout.driverId, driverId),
        eq(payout.status, "success"),
        gte(payout.settledAt, start),
        lt(payout.settledAt, end),
      ),
      orderBy: [desc(payout.settledAt)],
    });
  }

}

export const payoutRepository = new PayoutRepository();
