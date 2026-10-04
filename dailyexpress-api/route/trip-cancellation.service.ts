import { and, eq } from "drizzle-orm";
import { db, type DbTransaction } from "../db/connection";
import { booking, earning, payment, trip, type TripRecord } from "../db/index";
import { jobService } from "../workers/job.service";

type CancellationTransaction = DbTransaction;

export type TripCancellationOptions = {
  refundReason: string;
  emailReason?: "driver_deactivated" | "no_driver_found";
  requireDriverless?: boolean;
};

export class TripCancellationService {
  async cancelInTransaction(
    tx: CancellationTransaction,
    tripId: string,
    options: TripCancellationOptions,
  ): Promise<TripRecord | null> {
    const [lockedTrip] = await tx
      .select()
      .from(trip)
      .where(eq(trip.id, tripId))
      .for("update")
      .limit(1);

    if (
      !lockedTrip ||
      lockedTrip.status === "cancelled" ||
      lockedTrip.status === "completed" ||
      (options.requireDriverless && lockedTrip.driverId)
    ) {
      return null;
    }

    const [updatedTrip] = await tx
      .update(trip)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(trip.id, tripId))
      .returning();

    if (!updatedTrip) return null;

    const confirmedBookings = await tx
      .select({
        bookingId: booking.id,
        paymentReference: payment.reference,
      })
      .from(booking)
      .innerJoin(payment, eq(payment.bookingId, booking.id))
      .where(
        and(
          eq(booking.tripId, tripId),
          eq(booking.status, "confirmed"),
          eq(payment.status, "successful"),
        ),
      );

    await tx
      .update(booking)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(booking.tripId, tripId), eq(booking.status, "confirmed")));

    await tx.delete(earning).where(eq(earning.tripId, tripId));

    for (const confirmedBooking of confirmedBookings) {
      await jobService.enqueueTripRefund(tx, {
        bookingId: confirmedBooking.bookingId,
        paymentReference: confirmedBooking.paymentReference,
        refundReason: options.refundReason,
        emailReason: options.emailReason,
      });
    }

    return updatedTrip;
  }

  async cancelDriverlessTrip(
    tripId: string,
    options: Omit<TripCancellationOptions, "requireDriverless">,
  ): Promise<TripRecord | null> {
    return db.transaction((tx) =>
      this.cancelInTransaction(tx, tripId, {
        ...options,
        requireDriverless: true,
      }),
    );
  }
}

export const tripCancellationService = new TripCancellationService();
