import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "../db/connection";
import {
  driver,
  earning,
  payout,
  payoutAttempt,
  type EarningRecord,
  type PayoutRecord,
  type PayoutAttemptRecord,
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
        netAmount: earning.netAmount,
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

  findPayoutByEarningId(tx: PayoutTransaction | typeof db, earningId: string) {
    return tx.query.payout.findFirst({
      where: eq(payout.earningId, earningId),
    });
  }

  findPayoutById(id: string) {
    return db.query.payout.findFirst({
      where: eq(payout.id, id),
    });
  }

  insertPayout(tx: PayoutTransaction, values: typeof payout.$inferInsert) {
    return tx
      .insert(payout)
      .values(values)
      .onConflictDoNothing({ target: payout.earningId })
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


  findPayoutAttempt(payoutId: string, attemptNumber: number) {
    return db.query.payoutAttempt.findFirst({
      where: and(
        eq(payoutAttempt.payoutId, payoutId),
        eq(payoutAttempt.attemptNumber, attemptNumber),
      ),
    });
  }

  findPayoutAttemptByReference(reference: string) {
    return db.query.payoutAttempt.findFirst({
      where: eq(payoutAttempt.koraReference, reference),
    });
  }

  insertPayoutAttempt(
    values: typeof payoutAttempt.$inferInsert,
  ) {
    return db.insert(payoutAttempt).values(values);
  }

  updatePayoutAttempt(
    tx: PayoutTransaction | typeof db,
    id: string,
    fields: Partial<typeof payoutAttempt.$inferInsert>,
  ) {
    return tx
      .update(payoutAttempt)
      .set(fields)
      .where(eq(payoutAttempt.id, id));
  }

  updatePayoutAttemptByKey(
    payoutId: string,
    attemptNumber: number,
    fields: Partial<typeof payoutAttempt.$inferInsert>,
  ) {
    return db
      .update(payoutAttempt)
      .set(fields)
      .where(
        and(
          eq(payoutAttempt.payoutId, payoutId),
          eq(payoutAttempt.attemptNumber, attemptNumber),
        ),
      );
  }

  findDriverById(driverId: string) {
    return db.query.driver.findFirst({
      where: eq(driver.id, driverId),
    });
  }

  findDriverEarnings(driverId: string) {
    return db.query.earning.findMany({
      where: eq(earning.driverId, driverId),
      columns: { status: true, netAmount: true },
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
