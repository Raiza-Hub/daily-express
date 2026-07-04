import { and, desc, eq, gte, inArray, lt, notInArray, sql } from "drizzle-orm";
import { db } from "../db/connection";
import {
  booking,
  driver,
  earning,
  payout,
  payoutAttempt,
  payoutRecipient,
  payoutWebhook,
  trip,
  type EarningRecord,
  type PayoutRecord,
  type PayoutAttemptRecord,
  type PayoutRecipientRecord,
  type DriverRecord,
} from "../db/index";
import { HIDDEN_BOOKING_PAYMENT_STATUSES } from "../utils/route";
import type { DbTransaction } from "../db/connection";

type PayoutTransaction = DbTransaction;

export interface EarningsReconciliation {
  isReconciled: boolean;
  driverId: string | null;
  bookingCount: number;
  bookingAmountMinor: number;
  earningCount: number;
  earningAmountMinor: number;
}

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
        netAmountMinor: earning.netAmountMinor,
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

  async reconcileTripEarnings(
    tx: PayoutTransaction,
    tripId: string,
  ): Promise<EarningsReconciliation> {
    const tripRecord = await tx.query.trip.findFirst({
      where: eq(trip.id, tripId),
    });

    const [bookingTotals] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        amountMinor:
          sql<number>`coalesce(sum(${booking.fareAmount} * 100), 0)::bigint`.mapWith(
            Number,
          ),
      })
      .from(booking)
      .where(
        and(
          eq(booking.tripId, tripId),
          inArray(booking.status, ["confirmed", "completed"]),
          notInArray(
            booking.paymentStatus,
            HIDDEN_BOOKING_PAYMENT_STATUSES,
          ),
        ),
      );

    const [earningTotals] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        amountMinor:
          sql<number>`coalesce(sum(${earning.grossAmountMinor}), 0)::bigint`.mapWith(
            Number,
          ),
      })
      .from(earning)
      .where(
        and(
          eq(earning.tripId, tripId),
          notInArray(earning.status, ["cancelled", "manual_review"]),
        ),
      );

    const bookingCount = bookingTotals?.count ?? 0;
    const bookingAmountMinor = bookingTotals?.amountMinor ?? 0;
    const earningCount = earningTotals?.count ?? 0;
    const earningAmountMinor = earningTotals?.amountMinor ?? 0;
    const isReconciled =
      bookingCount === earningCount &&
      bookingAmountMinor === earningAmountMinor;

    return {
      isReconciled,
      driverId: tripRecord?.driverId ?? null,
      bookingCount,
      bookingAmountMinor,
      earningCount,
      earningAmountMinor,
    };
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

  findRecipientByDriverId(driverId: string) {
    return db.query.payoutRecipient.findFirst({
      where: eq(payoutRecipient.driverId, driverId),
    });
  }

  upsertRecipient(
    driverId: string,
    values: typeof payoutRecipient.$inferInsert,
  ) {
    const existingQuery = db.query.payoutRecipient.findFirst({
      where: eq(payoutRecipient.driverId, driverId),
    });

    return existingQuery.then(async (existing) => {
      if (existing) {
        const [updated] = await db
          .update(payoutRecipient)
          .set(values)
          .where(eq(payoutRecipient.id, existing.id))
          .returning();
        return updated;
      }
      const [created] = await db
        .insert(payoutRecipient)
        .values(values)
        .returning();
      return created;
    });
  }

  findDriverById(driverId: string) {
    return db.query.driver.findFirst({
      where: eq(driver.id, driverId),
    });
  }

  insertWebhook(values: typeof payoutWebhook.$inferInsert) {
    return db.insert(payoutWebhook).values(values).returning();
  }

  updateWebhookProcessedAt(webhookId: string) {
    return db
      .update(payoutWebhook)
      .set({ processedAt: new Date() })
      .where(eq(payoutWebhook.id, webhookId));
  }

  findDriverEarnings(driverId: string) {
    return db.query.earning.findMany({
      where: eq(earning.driverId, driverId),
      columns: { status: true, netAmountMinor: true },
    });
  }

  findPayoutHistory(
    whereClause: ReturnType<typeof and>,
    limit: number,
  ) {
    return db.query.payout.findMany({
      where: whereClause,
      orderBy: [desc(payout.createdAt)],
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

  findRecipientWithDriver(recipientId: string) {
    return db
      .select({
        recipient: payoutRecipient,
        driver,
      })
      .from(payoutRecipient)
      .leftJoin(driver, eq(driver.id, payoutRecipient.driverId))
      .where(eq(payoutRecipient.id, recipientId));
  }

  updatePayoutRecipient(
    tx: PayoutTransaction,
    payoutId: string,
    recipientId: string,
    driverEmail: string,
  ) {
    return tx
      .update(payout)
      .set({
        recipientId,
        driverEmail,
        updatedAt: new Date(),
      })
      .where(eq(payout.id, payoutId))
      .returning();
  }
}

export const payoutRepository = new PayoutRepository();
