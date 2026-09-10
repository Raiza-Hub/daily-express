import { renderEmail, getEmailSubject } from "@repo/email";
import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, earning, route, trip } from "../db/index";
import { getConfig } from "../config/index";
import { logger } from "../utils/logger";
import { calculateTrustedChargeAmount } from "../utils/payment";
import { formatAmount } from "../utils/payout";
import { formatBusinessDate } from "../utils/route";
import { enqueueEmail } from "../mail/email-dispatcher.service";
import { RouteRepository, routeRepository } from "./route.repository";

export class BookingFinalizerService {
  constructor(private repo: RouteRepository) {}

  /**
   * Slim payment-success finalizer. The trip was already reserved (and its
   * seats booked) at dispatch/checkout time, so this only:
   *  - confirms the booking + records the payment reference
   *  - creates the single earning for the trip's driver (amount = total fare)
   *  - sends the booking-confirmed email
   */
  async finalizeBooking(bookingId: string, reference: string) {
    const bookingRecord = await this.repo.findBookingById(bookingId);
    if (!bookingRecord) {
      logger.warn("booking_finalizer.booking_not_found", { bookingId, reference });
      return;
    }
    if (bookingRecord.paymentStatus === "successful" && bookingRecord.status === "confirmed") {
      logger.info("booking_finalizer.already_finalized", { bookingId, reference });
      return;
    }

    const routeRecord = await db.query.route.findFirst({
      where: eq(route.id, bookingRecord.routeId),
    });
    if (!routeRecord) {
      logger.warn("booking_finalizer.route_not_found", {
        bookingId,
        routeId: bookingRecord.routeId,
      });
      return;
    }

    const tripRecord = bookingRecord.tripId
      ? await db.query.trip.findFirst({ where: eq(trip.id, bookingRecord.tripId) })
      : null;
    const tripDriverId = tripRecord?.driverId ?? null;

    const passengerUser = bookingRecord.userId
      ? await this.repo.findUserById(bookingRecord.userId)
      : null;

    await db.transaction(async (tx) => {
      const [updatedBooking] = await tx
        .update(booking)
        .set({
          status: "confirmed",
          paymentStatus: "successful",
          paymentReference: reference,
          updatedAt: new Date(),
        })
        .where(and(eq(booking.id, bookingId), eq(booking.status, "pending")))
        .returning();

      if (!updatedBooking) {
        logger.info("booking_finalizer.booking_not_pending", { bookingId, reference });
        return;
      }

      if (tripDriverId && updatedBooking.tripId) {
        await tx
          .insert(earning)
          .values({
            driverId: tripDriverId,
            bookingId,
            tripId: updatedBooking.tripId,
            amount: updatedBooking.fareAmount,
            currency: "NGN",
            status: "pending_trip_completion",
          })
          .onConflictDoNothing();
      }

      if (passengerUser?.email) {
        const config = getConfig();
        const propsJson = JSON.stringify({
          frontendUrl: config.FRONTEND_URL,
          passengerName: `${updatedBooking.firstName ?? ""} ${updatedBooking.lastName ?? ""}`.trim() || null,
          paymentReference: reference,
          pricePaid: formatAmount(
            calculateTrustedChargeAmount(updatedBooking.fareAmount, updatedBooking.feeAmount),
            "NGN",
          ),
          pickupTitle: routeRecord.pickup_location_title,
          dropoffTitle: routeRecord.dropoff_location_title,
          tripDate: formatBusinessDate(updatedBooking.tripDate),
          departureTime: routeRecord.departure_time,
          timeZone: "Africa/Lagos",
          meetingPoint: routeRecord.meeting_point,
        });
        const emailHtml = await renderEmail("BookingConfirmedEmail", propsJson);
        const emailSubject = getEmailSubject("BookingConfirmedEmail", propsJson);
        await enqueueEmail(tx, {
          emailName: "email.booking_confirmed",
          to: passengerUser.email,
          subject: emailSubject,
          html: emailHtml,
        });
      }
    });

    logger.info("booking_finalizer.completed", {
      bookingId,
      reference,
      tripId: bookingRecord.tripId,
    });
  }
}

export const bookingFinalizerService = new BookingFinalizerService(routeRepository);
