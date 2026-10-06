import { and, count, eq, gte, ne, sql } from "drizzle-orm";
import { createServiceError } from "@shared/utils";
import { db } from "../db/connection";
import { booking, passenger, payment, refund, trip } from "../db/index";
import type { PaymentTransaction, TransactionStatus } from "./payment.types";
import { getRouteServiceTimeZone } from "../utils/db-datetime";

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

  setCheckoutUrl(id: string, checkoutUrl: string) {
    return db
      .update(payment)
      .set({ checkoutUrl, updatedAt: new Date() })
      .where(eq(payment.id, id))
      .returning();
  }

  deletePayment(id: string) {
    return db.delete(payment).where(eq(payment.id, id));
  }

  async findBookingFareByBookingId(bookingId: string, userId: string) {
    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
      columns: {
        totalAmount: true,
        totalFee: true,
        luggageCount: true,
        currency: true,
        userId: true,
      },
      with: {
        origin: { columns: { luggageFee: true } },
      },
    });

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
      luggageFee: bookingRecord.origin?.luggageFee ?? 0,
      currency: bookingRecord.currency.toUpperCase(),
    };
  }

  settlePayment(
    tx: PaymentTransaction,
    reference: string,
    status: TransactionStatus,
  ) {
    return tx
      .update(payment)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(payment.reference, reference), eq(payment.status, "pending")))
      .returning();
  }

  async findSuccessfulPaymentsForDriverUpcomingTrips(driverId: string) {
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
          gte(trip.date, sql`(now() AT TIME ZONE ${getRouteServiceTimeZone()})::date`),
          ne(trip.status, "cancelled"),
          eq(booking.status, "confirmed"),
          eq(payment.status, "successful"),
        ),
      );
  }
  insertRefund(tx: PaymentTransaction, values: typeof refund.$inferInsert) {
    return tx.insert(refund).values(values).returning();
  }

  findRefundByReference(reference: string) {
    return db.query.refund.findFirst({
      where: eq(refund.reference, reference),
    });
  }

  findPendingRefundByPaymentId(tx: PaymentTransaction, paymentId: string) {
    return tx.query.refund.findFirst({
      where: and(eq(refund.paymentId, paymentId), eq(refund.status, "pending")),
    });
  }

  pointPaymentAtRefund(
    tx: PaymentTransaction,
    paymentId: string,
    refundId: string,
  ) {
    return tx
      .update(payment)
      .set({ refundId, updatedAt: new Date() })
      .where(eq(payment.id, paymentId))
      .returning();
  }

  settleRefund(
    tx: PaymentTransaction,
    id: string,
    status: Exclude<TransactionStatus, "pending">,
  ) {
    return tx
      .update(refund)
      .set({ status, completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(refund.id, id), eq(refund.status, "pending")))
      .returning();
  }
}

export const paymentRepository = new PaymentRepository();
