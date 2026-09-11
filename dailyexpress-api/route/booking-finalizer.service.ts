import { renderEmail, getEmailSubject } from "@repo/email";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, type DbTransaction } from "../db/connection";
import {
  booking,
  route,
  TRIP_CAPACITY,
  type BookingRecord,
  type RouteRecord,
  type TripRecord,
  type UserRecord,
} from "../db/index";
import { getConfig } from "../config/index";
import { logger } from "../utils/logger";
import { formatAmount } from "../utils/payout";
import { formatBusinessDate, getBusinessDayWindow } from "../utils/route";
import { enqueueEmail } from "../mail/email-dispatcher.service";
import { earningService } from "../payout/earning.service";
import { RouteRepository, routeRepository } from "./route.repository";

type RouteTransaction = DbTransaction;

export class BookingFinalizerService {
  constructor(private repo: RouteRepository) {}

  /**
   * Payment-success finalizer. Runs entirely inside a transaction serialized
   * on a slot-level advisory lock, so it either:
   *  - assigns the booking to the best-fit existing trip for its slot
   *    (tightest fit first, locked FOR UPDATE), or
   *  - creates a new trip for the slot (TRIP_CAPACITY, awaiting a driver)
   * Then upserts the trip's single earning row (amount = aggregate over the
   * trip's confirmed/completed bookings, platform fee excluded) and sends the
   * booking-confirmed email to the booker.
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

    const passengerUser = bookingRecord.userId
      ? await this.repo.findUserById(bookingRecord.userId)
      : null;

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

        const passengerCount = await this.repo.countPassengersByBooking(
          tx,
          bookingId,
        );
        if (passengerCount === 0) {
          logger.warn("booking_finalizer.no_passengers", { bookingId, reference });
          return null;
        }

        const { dateKey, start, end } = getBusinessDayWindow(
          formatBusinessDate(updatedBooking.tripDate),
        );

        const tripId = await this.assignBookingToTrip(tx, {
          bookingId,
          routeId: routeRecord.id,
          dateKey,
          start,
          end,
          departureTime: updatedBooking.departureTime,
          arrivalTime: updatedBooking.arrivalTime,
          passengerCount,
        });

        if (!tripId) return null;

        await this.upsertTripEarning(tx, tripId);

        if (passengerUser?.email) {
          await this.dispatchConfirmationEmail(tx, bookingRecord, routeRecord, passengerUser, reference);
        }

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

  private async dispatchConfirmationEmail(
    tx: RouteTransaction,
    bookingRecord: BookingRecord,
    routeRecord: RouteRecord,
    passengerUser: UserRecord,
    reference: string,
  ) {
    const config = getConfig();
    const boardingFromPickup = bookingRecord.boardingPoint !== "dropoff";
    const pickupTitle = boardingFromPickup
      ? routeRecord.pickup_point
      : routeRecord.dropoff_point;
    const dropoffTitle = boardingFromPickup
      ? (routeRecord.train_station_title ?? routeRecord.destination_title)
      : routeRecord.origin_title;

    const passengerCount = await this.repo.countPassengersByBooking(
      tx,
      bookingRecord.id,
    );
    const groupTotal = bookingRecord.totalAmount + bookingRecord.totalFee;
    const propsJson = JSON.stringify({
      frontendUrl: config.FRONTEND_URL,
      passengerName:
        `${passengerUser.firstName ?? ""} ${passengerUser.lastName ?? ""}`.trim() ||
        null,
      paymentReference: reference,
      pricePaid: formatAmount(groupTotal, "NGN"),
      pickupTitle,
      dropoffTitle,
      tripDate: formatBusinessDate(bookingRecord.tripDate),
      departureTime: bookingRecord.departureTime,
      timeZone: "Africa/Lagos",
      meetingPoint: pickupTitle,
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

  /**
   * Serializes on the slot key so concurrent confirmations for the same slot
   * run one at a time (an advisory lock can guard the empty-list race where
   * FOR UPDATE cannot), then picks the tightest-fit trip that still has room
   * or creates a new one.
   */
  private async assignBookingToTrip(
    tx: RouteTransaction,
    input: {
      bookingId: string;
      routeId: string;
      dateKey: string;
      start: Date;
      end: Date;
      departureTime: string;
      arrivalTime: string;
      passengerCount: number;
    },
  ): Promise<string | null> {
    const slotKey = `${input.routeId}::${input.dateKey}::${input.departureTime}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${slotKey}, 0))`);

    const trips = await this.repo.findTripsForSlot(
      tx,
      input.routeId,
      input.start,
      input.end,
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

    const createdTrip = await this.createSlotTrip(tx, input);
    await tx
      .update(booking)
      .set({ tripId: createdTrip.id, updatedAt: new Date() })
      .where(eq(booking.id, input.bookingId));
    return createdTrip.id;
  }

  private async createSlotTrip(
    tx: RouteTransaction,
    input: {
      routeId: string;
      start: Date;
      departureTime: string;
      arrivalTime: string;
      passengerCount: number;
    },
  ): Promise<TripRecord> {
    const createdTrip = await this.repo.createTrip(tx, {
      routeId: input.routeId,
      driverId: null,
      date: input.start,
      departureTime: input.departureTime,
      arrivalTime: input.arrivalTime,
      capacity: TRIP_CAPACITY,
      bookedSeats: input.passengerCount,
      status: "awaiting_driver",
    });
    logger.info("booking_finalizer.trip_created", {
      tripId: createdTrip.id,
      routeId: input.routeId,
      date: input.start,
      departureTime: input.departureTime,
      bookedSeats: createdTrip.bookedSeats,
    });
    return createdTrip;
  }

  /**
   * Recomputes the trip's aggregate earning from its confirmed/completed
   * bookings: (fareAmount x passengerCount) + (luggageCount x luggage_fee),
   * platform fee excluded. One earning row per trip (unique tripId), driverId
   * stays NULL until dispatch backfills it.
   */
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

    const routeRecord = await tx.query.route.findFirst({
      where: eq(route.id, firstBooking.routeId),
    });

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

export const bookingFinalizerService = new BookingFinalizerService(routeRepository);