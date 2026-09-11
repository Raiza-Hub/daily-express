import { and, count, eq, gt, gte, inArray, ne, sql } from "drizzle-orm";
import { createServiceError } from "@shared/utils";
import { db } from "../db/connection";
import {
  booking,
  passenger,
  payment,
  refund,
  route,
  trip,
  type BookingRecord,
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

  updateProcessingPayment(reference: string, status: PaymentStatus, fields: Partial<typeof payment.$inferInsert>) {
    return db
      .update(payment)
      .set({ status, ...fields, updatedAt: new Date() })
      .where(and(eq(payment.reference, reference), eq(payment.status, "processing")))
      .returning();
  }

  async updateBookingPaymentStatus(
    tx: PaymentTransaction,
    input: {
      bookingId?: string | null;
      paymentReference: string;
      paymentStatus: "initialized" | "pending" | "successful" | "failed" | "cancelled" | "expired";
    },
  ): Promise<{
    booking: BookingRecord | null;
    confirmed: boolean;
    cancelled: boolean;
    cancelledConfirmed: boolean;
  }> {
    const bookingId = input.bookingId;
    if (!bookingId) {
      return {
        booking: null,
        confirmed: false,
        cancelled: false,
        cancelledConfirmed: false,
      };
    }

    const existingBooking = await tx.query.booking.findFirst({
      where: eq(booking.id, bookingId),
    });

    if (!existingBooking) {
      return {
        booking: null,
        confirmed: false,
        cancelled: false,
        cancelledConfirmed: false,
      };
    }

    const nextBookingStatus =
      input.paymentStatus === "successful"
        ? "confirmed"
        : input.paymentStatus === "failed" ||
            input.paymentStatus === "cancelled" ||
            input.paymentStatus === "expired"
          ? "cancelled"
          : ("pending" as const);

    const isCancellingTransition =
      nextBookingStatus === "cancelled" &&
      existingBooking.status !== "cancelled";
    const isCancellingConfirmedBooking =
      isCancellingTransition && existingBooking.status === "confirmed";
    const shouldConfirm =
      input.paymentStatus === "successful" &&
      nextBookingStatus === "confirmed" &&
      existingBooking.status !== "confirmed";

    const updatePayload: Record<string, unknown> = {
      paymentReference: input.paymentReference,
      paymentStatus: input.paymentStatus,
      updatedAt: new Date(),
    };

    if (
      !(
        (existingBooking.status === "confirmed" &&
          nextBookingStatus !== "confirmed") ||
        (existingBooking.status === "cancelled" &&
          nextBookingStatus === "pending")
      )
    ) {
      updatePayload.status = nextBookingStatus;
    }

    if (isCancellingTransition && existingBooking.tripId) {
      const passengerCount = await this.countPassengersByBooking(
        tx,
        existingBooking.id,
      );
      await tx
        .update(trip)
        .set({ bookedSeats: sql`GREATEST(${trip.bookedSeats} - ${Math.max(passengerCount, 1)}, 0)` })
        .where(
          and(eq(trip.id, existingBooking.tripId), gt(trip.bookedSeats, 0)),
        );
    }

    const [updatedBooking] = await tx
      .update(booking)
      .set(updatePayload)
      .where(eq(booking.id, bookingId))
      .returning();

    return {
      booking: updatedBooking,
      confirmed: shouldConfirm,
      cancelled: isCancellingTransition,
      cancelledConfirmed: isCancellingConfirmedBooking,
    };
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
