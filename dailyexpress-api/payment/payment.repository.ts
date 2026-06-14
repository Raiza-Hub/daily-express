import { and, eq, gt, gte, ne, sql } from "drizzle-orm";
import { createServiceError } from "@shared/utils";
import { db } from "../db/connection";
import {
  booking,
  driver,
  earning,
  payment,
  paymentWebhook,
  route,
  trip,
  users,
} from "../db/index";
import type { PaymentStatus } from "./payment.types";

type PaymentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PaymentRecord = typeof payment.$inferSelect;
type BookingRecord = typeof booking.$inferSelect;

export interface BookingDetails {
  booking: typeof booking.$inferSelect;
  trip: typeof trip.$inferSelect;
  route: typeof route.$inferSelect;
  passenger: typeof users.$inferSelect | null;
  driver: typeof driver.$inferSelect | null;
}

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

  async findBookingFareByBookingId(bookingId: string, userId: string) {
    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
    });

    if (!bookingRecord || bookingRecord.userId !== userId) {
      throw createServiceError("Booking not found", 404);
    }

    return {
      fareAmount: bookingRecord.fareAmount,
      currency: bookingRecord.currency.toUpperCase(),
    };
  }

  insertPayment(
    tx: PaymentTransaction,
    values: typeof payment.$inferInsert,
  ) {
    return tx.insert(payment).values(values).returning();
  }

  updatePayment(
    reference: string,
    status: PaymentStatus,
    fields: Partial<typeof payment.$inferInsert>,
  ) {
    return db
      .update(payment)
      .set({ status, ...fields, updatedAt: new Date() })
      .where(
        and(eq(payment.reference, reference), eq(payment.status, "pending")),
      )
      .returning();
  }

  updatePaymentInTransaction(
    tx: PaymentTransaction,
    reference: string,
    fields: Partial<typeof payment.$inferInsert>,
  ) {
    return tx
      .update(payment)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(payment.reference, reference))
      .returning();
  }

  updatePaymentStatusByIdInTransaction(
    tx: PaymentTransaction,
    id: string,
    fields: Partial<typeof payment.$inferInsert>,
  ) {
    return tx
      .update(payment)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(payment.id, id))
      .returning();
  }

  lockPaymentForExpiry(reference: string) {
    return db
      .update(payment)
      .set({ lastStatusCheckAt: new Date() })
      .where(
        and(eq(payment.reference, reference), eq(payment.status, "pending")),
      )
      .returning();
  }

  insertWebhook(
    tx: PaymentTransaction,
    values: typeof paymentWebhook.$inferInsert,
  ) {
    return tx.insert(paymentWebhook).values(values);
  }

  findBookingDetailsByBookingId(bookingId: string): Promise<BookingDetails | undefined> {
    return db
      .select({
        booking,
        trip,
        route,
        passenger: users,
        driver,
      })
      .from(booking)
      .innerJoin(trip, eq(trip.id, booking.tripId))
      .innerJoin(route, eq(route.id, trip.routeId))
      .leftJoin(users, eq(users.id, booking.userId))
      .leftJoin(driver, eq(driver.id, trip.driverId))
      .where(eq(booking.id, bookingId))
      .then((rows) => rows[0] as BookingDetails | undefined);
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

    if (isCancellingTransition) {
      updatePayload.seatNumber = null;
      await tx
        .update(trip)
        .set({ bookedSeats: sql`GREATEST(${trip.bookedSeats} - 1, 0)` })
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

  findEarningByBookingId(bookingId: string) {
    return db.query.earning.findFirst({
      where: eq(earning.bookingId, bookingId),
    });
  }

  cancelEarningByBookingId(
    tx: PaymentTransaction,
    bookingId: string,
  ) {
    return tx
      .update(earning)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(earning.bookingId, bookingId));
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

  findTripDriverId(tripId: string) {
    return db.query.trip.findFirst({
      where: eq(trip.id, tripId),
      columns: { driverId: true },
    });
  }

  updatePaymentRefundStatus(
    reference: string,
    status: "refunded" | "refund_failed",
  ) {
    return db.transaction(async (tx) => {
      await tx
        .update(payment)
        .set({
          status,
          updatedAt: new Date(),
          metadata: sql`COALESCE(${payment.metadata},'{}'::jsonb)||${JSON.stringify({
            refundCompletedAt: new Date().toISOString(),
            refundFinalStatus: status,
          })}::jsonb`,
        })
        .where(eq(payment.reference, reference));

      const [bookingRecord] = await tx
        .update(booking)
        .set({ paymentStatus: status, updatedAt: new Date() })
        .where(eq(booking.paymentReference, reference))
        .returning();

      return { booking: bookingRecord ?? null };
    });
  }

  updateRefundInTransaction(
    tx: PaymentTransaction,
    id: string,
    status: "refund_pending" | "refunded" | "refund_failed",
    reason: string,
    metadataUpdate: Record<string, unknown>,
  ) {
    return tx
      .update(payment)
      .set({
        status,
        failureCode: "AUTO_REFUND_INITIATED",
        failureReason: reason,
        updatedAt: new Date(),
        metadata: sql`COALESCE(${payment.metadata},'{}'::jsonb)||${JSON.stringify(metadataUpdate)}::jsonb`,
      })
      .where(
        and(eq(payment.reference, id), eq(payment.status, "expired")),
      )
      .returning();
  }
}
