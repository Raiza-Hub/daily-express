import { renderEmail, getEmailSubject } from "@repo/email";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, type DbTransaction } from "../db/connection";
import {
  booking,
  origin,
  destination,
  TRIP_CAPACITY,
  type BookingRecord,
  type OriginRecord,
  type DestinationRecord,
  type TripRecord,
} from "../db/index";
import { getConfig } from "../config/index";
import { logger } from "../utils/logger";
import { formatAmount } from "../utils/payout";
import { enqueueEmail } from "../mail/email-dispatcher.service";
import { earningService } from "../payout/earning.service";
import { RouteRepository } from "./route.repository";

type RouteTransaction = DbTransaction;

export class BookingFinalizerService {
  constructor(private repo: RouteRepository) {}

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

    const originRecord = await db.query.origin.findFirst({
      where: eq(origin.id, bookingRecord.originId),
    });
    const destinationRecord = await db.query.destination.findFirst({
      where: eq(destination.id, bookingRecord.destinationId),
    });
    if (!originRecord || !destinationRecord) {
      logger.warn("booking_finalizer.route_not_found", {
        bookingId,
        originId: bookingRecord.originId,
        destinationId: bookingRecord.destinationId,
      });
      return;
    }

    const finalized = await db.transaction<{ tripId: string } | null>(
      async (tx) => {
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
          return null;
        }

        const passengers = await this.repo.findPassengersByBooking(bookingId);
        if (passengers.length === 0) {
          logger.warn("booking_finalizer.no_passengers", { bookingId, reference });
          return null;
        }

        const dateKey = updatedBooking.tripDate;

        const tripId = await this.assignBookingToTrip(tx, {
          bookingId,
          originId: originRecord.id,
          destinationId: destinationRecord.id,
          dateKey,
          departureTime: updatedBooking.departureTime,
          passengerCount: passengers.length,
        });

        if (!tripId) return null;

        await this.upsertTripEarning(tx, tripId);

        await this.dispatchConfirmationEmails(tx, updatedBooking, originRecord, destinationRecord, passengers);

        return { tripId };
      },
    );

    if (finalized) {
      logger.info("booking_finalizer.completed", {
        bookingId,
        reference,
        tripId: finalized.tripId,
      });
    }
  }

  private async dispatchConfirmationEmails(
    tx: RouteTransaction,
    bookingRecord: BookingRecord,
    originRecord: OriginRecord,
    destinationRecord: DestinationRecord,
    passengers: Array<{ fullName: string; email: string }>,
  ) {
    const config = getConfig();
    const groupTotal = bookingRecord.totalAmount + bookingRecord.totalFee;
    const pricePaid = formatAmount(groupTotal, "NGN");

    for (const passenger of passengers) {
      const propsJson = JSON.stringify({
        frontendUrl: config.FRONTEND_URL,
        passengerName: passenger.fullName || null,
        pricePaid,
        origin: originRecord.title,
        destination: destinationRecord.title,
        tripDate: bookingRecord.tripDate,
        departureTime: bookingRecord.departureTime,
        timeZone: "Africa/Lagos",
        meetingPoint: originRecord.meetingPoint,
      });
      const emailHtml = await renderEmail("BookingConfirmedEmail", propsJson);
      const emailSubject = getEmailSubject("BookingConfirmedEmail", propsJson);
      enqueueEmail(tx, {
        emailName: "email.booking_confirmed",
        to: passenger.email,
        subject: emailSubject,
        html: emailHtml,
      });
    }
  }

  private async assignBookingToTrip(
    tx: RouteTransaction,
    input: {
      bookingId: string;
      originId: string;
      destinationId: string;
      dateKey: string;
      departureTime: string;
      passengerCount: number;
    },
  ): Promise<string | null> {
    const slotKey = `${input.originId}::${input.destinationId}::${input.dateKey}::${input.departureTime}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${slotKey}, 0))`);

    const trips = await this.repo.findTripsForSlot(
      tx,
      input.originId,
      input.destinationId,
      input.dateKey,
      input.departureTime,
    );

    const fit = trips.find((trip) => trip.bookedSeats + input.passengerCount <= trip.capacity);
    if (fit) {
      await tx
        .update(booking)
        .set({ tripId: fit.id, updatedAt: new Date() })
        .where(eq(booking.id, input.bookingId));
      return fit.id;
    }

    const createdTrip = await this.createSlotTrip(tx, {
      originId: input.originId,
      destinationId: input.destinationId,
      date: input.dateKey,
      departureTime: input.departureTime,
      passengerCount: input.passengerCount,
    });
    await tx
      .update(booking)
      .set({ tripId: createdTrip.id, updatedAt: new Date() })
      .where(eq(booking.id, input.bookingId));
    return createdTrip.id;
  }

  private async createSlotTrip(
    tx: RouteTransaction,
    input: {
      originId: string;
      destinationId: string;
      date: string;
      departureTime: string;
      passengerCount: number;
    },
  ): Promise<TripRecord> {
    const createdTrip = await this.repo.createTrip(tx, {
      originId: input.originId,
      destinationId: input.destinationId,
      driverId: null,
      date: input.date,
      departureTime: input.departureTime,
      capacity: TRIP_CAPACITY,
      bookedSeats: input.passengerCount,
      status: "awaiting_driver",
    });
    logger.info("booking_finalizer.trip_created", {
      tripId: createdTrip.id,
      originId: input.originId,
      destinationId: input.destinationId,
      date: input.date,
      departureTime: input.departureTime,
      bookedSeats: createdTrip.bookedSeats,
    });
    return createdTrip;
  }

  private async upsertTripEarning(
    tx: RouteTransaction,
    tripId: string,
  ) {
    const tripBookings = await tx.query.booking.findMany({
      where: and(
        eq(booking.tripId, tripId),
        inArray(booking.status, ["confirmed", "completed"]),
      ),
    });

    const firstBooking = tripBookings[0];
    if (!firstBooking) return;

    let amount = 0;
    for (const tripBooking of tripBookings) {
      amount += tripBooking.totalAmount;
    }

    if (amount <= 0) return;

    await earningService.createEarning(tx, {
      tripId,
      driverId: null,
      amount,
      currency: "NGN",
    });

    logger.info("booking_finalizer.earning_upserted", {
      tripId,
      amount,
      bookingCount: tripBookings.length,
    });
  }
}

export const bookingFinalizerService = new BookingFinalizerService(new RouteRepository());