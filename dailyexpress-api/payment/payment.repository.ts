import { and, count, eq, gte, inArray, ne } from "drizzle-orm";
import { createServiceError } from "@shared/utils";
import { db } from "../db/connection";
import {
  booking,
  passenger,
  payment,
  refund,
  route,
  trip,
} from "../db/index";
import type { PaymentStatus, PaymentTransaction } from "./payment.types";

export class PaymentRepository {
  findPaymentByReference(reference: string) {
    return db.query.payment.findFirst({
      where: eq(payment.reference, reference),
    });
  }

  findPaymentByBookingId(bookingId: string) {
    return db.query.payment.findFirst({
      where: eq(payment.bookingId, bookingId),
    });
  }

  insertPayment(values: typeof payment.$inferInsert) {
    return db
      .insert(payment)
      .values(values)
      .onConflictDoNothing({ target: payment.bookingId })
      .returning();
  }

  setPendingCheckout(id: string, checkoutUrl: string) {
    return db
      .update(payment)
      .set({ status: "pending", checkoutUrl, updatedAt: new Date() })
      .where(eq(payment.id, id))
      .returning();
  }

  deletePayment(id: string) {
    return db.delete(payment).where(eq(payment.id, id));
  }

  findPaymentsByBookingIds(bookingIds: string[]) {
    if (bookingIds.length === 0) return Promise.resolve([]);
    return db.query.payment.findMany({
      where: inArray(payment.bookingId, bookingIds),
    });
  }

  async findBookingFareByBookingId(bookingId: string, userId: string) {
    const row = await db
      .select({
        totalAmount: booking.totalAmount,
        totalFee: booking.totalFee,
        luggageCount: booking.luggageCount,
        currency: booking.currency,
        userId: booking.userId,
        luggageFee: route.luggage_fee,
      })      .from(booking)
      .innerJoin(route, eq(route.id, booking.routeId))
      .where(eq(booking.id, bookingId));

    const bookingRecord = row[0];
    if (!bookingRecord || bookingRecord.userId !== userId) {
      throw createServiceError("Booking not found", 404);
    }

    const [{ passengerCount }] = await db
      .select({ passengerCount: count() })
      .from(passenger)
      .where(eq(passenger.bookingId, bookingId));

    return {
      totalAmount: bookingRecord.totalAmount,
      totalFee: bookingRecord.totalFee ?? 0,
      passengerCount: Number(passengerCount),
      luggageCount: bookingRecord.luggageCount,
      luggageFee: bookingRecord.luggageFee ?? 0,
      currency: bookingRecord.currency.toUpperCase(),
    };
  }

  countPassengersByBooking(
    tx: PaymentTransaction,
    bookingId: string,
  ) {
    return tx
      .select({ count: count() })
      .from(passenger)
      .where(eq(passenger.bookingId, bookingId))
      .then((rows) => Number(rows[0]?.count ?? 0));
  }

  claimPayment(reference: string) {
    return db
      .update(payment)
      .set({ status: "processing", updatedAt: new Date() })
      .where(and(eq(payment.reference, reference), eq(payment.status, "pending")))
      .returning();
  }

  updateProcessingPayment(reference: string, status: PaymentStatus, fields?: Partial<typeof payment.$inferInsert>) {
    return db
      .update(payment)
      .set({ status, ...fields, updatedAt: new Date() })
      .where(and(eq(payment.reference, reference), eq(payment.status, "processing")))
      .returning();
  }

  async findSuccessfulPaymentsForDriverUpcomingTrips(
    driverId: string,
    startDate: Date,
  ) {
    return db
      .select({
        payment: payment,
        booking: booking,
        trip: trip,
      })
      .from(payment)
      .innerJoin(booking, eq(booking.id, payment.bookingId))
      .innerJoin(trip, eq(trip.id, booking.tripId))
      .where(
        and(
          eq(trip.driverId, driverId),
          gte(trip.date, startDate),
          ne(trip.status, "cancelled"),
          eq(booking.status, "confirmed"),
          eq(payment.status, "successful"),
        ),
      );
  }

  // ── Refund table methods ──

  insertRefund(tx: PaymentTransaction, values: typeof refund.$inferInsert) {
    return tx.insert(refund).values(values).returning();
  }

  findRefundByReference(ref: string) {
    return db.query.refund.findFirst({
      where: eq(refund.reference, ref),
    });
  }

  updateRefundStatus(
    tx: PaymentTransaction,
    id: string,
    fields: Partial<typeof refund.$inferInsert>,
  ) {
    return tx
      .update(refund)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(refund.id, id))
      .returning();
  }
}

export const paymentRepository = new PaymentRepository();
