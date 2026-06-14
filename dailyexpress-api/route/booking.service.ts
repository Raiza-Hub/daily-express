import { createServiceError } from "@shared/utils";
import { and, desc, eq, getTableColumns, inArray, lt, ne, notInArray, sql } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, driver, route, trip, users } from "../db/index";
import { logger } from "../utils/logger";
import {
    getBusinessDayWindow,
    getScheduledDepartureTime,
    HIDDEN_BOOKING_PAYMENT_STATUSES,
    isConstraintError
} from "../utils/route";
import { timeAsync } from "../utils/timing";
import { RouteRepository } from "./route.repository";
import {
    BOOKABLE_TRIP_STATUSES,
    normalizePageLimit,
    decodeCursor,
    encodeCursor,
    isValidUserBookingsCursor,
    VISIBLE_BOOKING_STATUSES,
} from "./utils";

type RouteTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type BookingRecord = typeof booking.$inferSelect;
type TripRecord = typeof trip.$inferSelect;
type RouteRecord = typeof route.$inferSelect;

type CreateBookingInput = {
  routeId: string;
  tripDate: string;
};

export class BookingService {
  constructor(private repo: RouteRepository) {}

  async createCheckoutBooking(userId: string, input: CreateBookingInput) {
    const result = await this.createBookingResult(userId, input);
    return {
      booking: result.booking,
      fareAmount: result.fareAmount,
      currency: result.currency,
      expiresAt: result.booking.expiresAt,
    };
  }

  async getUserBookings(userId: string, limit = 20, cursor?: string) {
    const parsedLimit = normalizePageLimit(limit);
    const decodedCursor = decodeCursor(cursor, isValidUserBookingsCursor);
    const visibleBookingConditions = and(
      eq(booking.userId, userId),
      inArray(booking.status, [...VISIBLE_BOOKING_STATUSES]),
      notInArray(booking.paymentStatus, ["failed", "cancelled", "expired"]),
    );
    const cursorCondition = decodedCursor
      ? lt(booking.createdAt, new Date(decodedCursor.createdAt))
      : undefined;
    const bookingRows = await timeAsync(
      "route.get_user_bookings.query_bookings",
      { userId, limit: parsedLimit, hasCursor: Boolean(cursor) },
      () =>
        db
          .select({
            booking: getTableColumns(booking),
            trip: getTableColumns(trip),
            route: getTableColumns(route),
            driver: getTableColumns(driver),
          })
          .from(booking)
          .innerJoin(trip, eq(booking.tripId, trip.id))
          .innerJoin(route, eq(trip.routeId, route.id))
          .innerJoin(driver, eq(route.driverId, driver.id))
          .where(
            and(
              visibleBookingConditions,
              ne(trip.status, "cancelled"),
              cursorCondition,
            ),
          )
          .orderBy(desc(booking.createdAt))
          .limit(parsedLimit + 1),
    );
    const pageBookingRows = bookingRows.slice(0, parsedLimit);
    const nextBookingRow = bookingRows[parsedLimit];
    const lastBookingRow = pageBookingRows[pageBookingRows.length - 1];

    const bookings = pageBookingRows.map((row) => ({
      id: row.booking.id,
      seatNumber: row.booking.seatNumber ?? 0,
      fareAmount: row.booking.fareAmount,
      currency: row.booking.currency,
      status: row.booking.status,
      paymentReference: row.booking.paymentReference ?? null,
      paymentStatus: row.booking.paymentStatus,
      createdAt: row.booking.createdAt,
      updatedAt: row.booking.updatedAt,
      tripId: row.booking.tripId,
      trip: {
        id: row.trip.id,
        date: row.trip.date,
        status: row.trip.status,
        bookedSeats: row.trip.bookedSeats,
        capacity: row.trip.capacity,
        availableSeats: Math.max(row.trip.capacity - row.trip.bookedSeats, 0),
        route: {
          id: row.route.id,
          pickupLocationTitle: row.route.pickup_location_title,
          pickupLocationLocality: row.route.pickup_location_locality,
          pickupLocationLabel: row.route.pickup_location_label,
          dropoffLocationTitle: row.route.dropoff_location_title,
          dropoffLocationLocality: row.route.dropoff_location_locality,
          dropoffLocationLabel: row.route.dropoff_location_label,
          price: row.route.price,
          vehicleType: row.route.vehicleType,
          meetingPoint: row.route.meeting_point,
          departureTime: row.route.departure_time,
          arrivalTime: row.route.arrival_time,
          driver: {
            id: row.driver.id,
            firstName: row.driver.firstName,
            lastName: row.driver.lastName,
            phoneNumber: row.driver.phone,
            profilePictureUrl: row.driver.profile_pic ?? null,
            country: row.driver.country,
            state: row.driver.state,
          },
        },
      },
    }));

    return {
      bookings,
      nextCursor:
        nextBookingRow && lastBookingRow
          ? encodeCursor({
              createdAt: lastBookingRow.booking.createdAt.toISOString(),
            })
          : null,
    };
  }

  async searchBookingByRef(
    userId: string,
    paymentReference: string,
    lastName: string,
  ): Promise<BookingRecord | null> {
    const normalizedLastName = lastName.trim().toLowerCase();
    return this.repo.findBookingByPaymentRef(
      userId,
      paymentReference,
      normalizedLastName,
    );
  }

  async getTripBookings(user: { userId: string }, tripId: string) {
    const driverRecord = await this.repo.findDriverByUserId(user.userId);
    if (!driverRecord) {
      throw createServiceError("Driver not found", 404);
    }

    const bookingRows = await db
      .select({
        tripId: trip.id,
        booking: getTableColumns(booking),
        userProfilePicture: users.profilePictureUrl,
      })
      .from(trip)
      .leftJoin(
        booking,
        and(
          eq(booking.tripId, trip.id),
          eq(booking.status, "confirmed"),
          notInArray(booking.paymentStatus, HIDDEN_BOOKING_PAYMENT_STATUSES),
        ),
      )
      .leftJoin(users, eq(users.id, booking.userId))
      .where(and(eq(trip.id, tripId), eq(trip.driverId, driverRecord.id)));

    if (bookingRows.length === 0) {
      throw createServiceError("Trip not found", 404);
    }

    return bookingRows.flatMap((row) =>
      row.booking
        ? [
            {
              id: row.booking.id,
              seatNumber: row.booking.seatNumber ?? 0,
              status: row.booking.status,
              paymentStatus: row.booking.paymentStatus,
              createdAt: row.booking.createdAt,
              user: {
                firstName: row.booking.firstName ?? "Passenger",
                lastName: row.booking.lastName ?? "",
                profilePictureUrl: row.userProfilePicture,
              },
            },
          ]
        : [],
    );
  }

  private async allocateLowestAvailableSeat(
    tx: RouteTransaction,
    tripId: string,
  ): Promise<{
    trip: TripRecord;
    seatNumber: number;
    activeBookingCount: number;
  }> {
    const lockedTrip = await this.repo.lockTrip(tx, tripId);
    if (!lockedTrip) {
      throw createServiceError("Trip not found", 404);
    }

    if (!BOOKABLE_TRIP_STATUSES.has(lockedTrip.status)) {
      throw createServiceError("Trip is not open for booking", 400);
    }

    const seatRows = (await tx.execute(sql`
      WITH active_bookings AS (
        SELECT seat_number
        FROM booking
        WHERE trip_id = ${tripId}
          AND status IN ('pending', 'confirmed')
          AND seat_number IS NOT NULL
      ),
      active_count AS (
        SELECT count(*)::int AS value
        FROM active_bookings
      )
      SELECT
        candidate.seat_number,
        active_count.value AS active_booking_count
      FROM active_count
      CROSS JOIN LATERAL (
        SELECT candidate_seat.seat_number
        FROM generate_series(1, ${lockedTrip.capacity}) AS candidate_seat(seat_number)
        WHERE NOT EXISTS (
          SELECT 1
          FROM active_bookings
          WHERE active_bookings.seat_number = candidate_seat.seat_number
        )
        ORDER BY candidate_seat.seat_number
        LIMIT 1
      ) AS candidate
    `)) as Array<{
      seat_number: number;
      active_booking_count: number;
    }>;

    const seatRow = seatRows[0];
    if (!seatRow) {
      throw createServiceError("Trip is full", 400);
    }

    return {
      trip: lockedTrip,
      seatNumber: seatRow.seat_number,
      activeBookingCount: seatRow.active_booking_count,
    };
  }

  private async createBookingResult(userId: string, input: CreateBookingInput) {
    const passengerRecord = await this.repo.findUserById(userId);
    if (!passengerRecord) {
      throw createServiceError("Passenger not found", 404);
    }

    const { start, end } = getBusinessDayWindow(input.tripDate);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const result = await db.transaction(async (tx) => {
      const routeRecord = await tx.query.route.findFirst({
        where: eq(route.id, input.routeId),
      });
      if (!routeRecord) throw createServiceError("Route not found", 404);
      if (routeRecord.status !== "active") {
        throw createServiceError("Route is not open for booking", 400);
      }

      const scheduledDepartureTime = getScheduledDepartureTime(
        input.tripDate,
        routeRecord.departure_time,
      );
      if (scheduledDepartureTime <= new Date()) {
        throw createServiceError(
          "This trip has already departed and can no longer be booked",
          400,
        );
      }

      let tripRecord = await this.repo.findTripByRouteAndDate(
        input.routeId,
        start,
        end,
      );

      if (!tripRecord) {
        const createdTrip = await this.repo.insertTrip(tx, {
          routeId: routeRecord.id,
          driverId: routeRecord.driverId,
          date: start,
          capacity: routeRecord.availableSeats,
          bookedSeats: 0,
          status: "pending",
        });
        tripRecord =
          createdTrip ??
          (await this.repo.findTripByRouteAndDate(input.routeId, start, end));
      }

      if (!tripRecord) throw createServiceError("Trip not found", 404);

      const lockedTrip = await this.repo.lockTrip(tx, tripRecord.id);
      if (!lockedTrip || !BOOKABLE_TRIP_STATUSES.has(lockedTrip.status)) {
        throw createServiceError("Trip is not open for booking", 400);
      }
      tripRecord = lockedTrip;

      const existingBooking = await this.repo.findExistingActiveBooking(
        tx,
        tripRecord.id,
        userId,
      );

      if (existingBooking) {
        if (existingBooking.status === "confirmed") {
          throw createServiceError(
            "You already have a confirmed booking for this trip",
            409,
          );
        }
        const isExpired =
          existingBooking.expiresAt instanceof Date &&
          existingBooking.expiresAt.getTime() <= Date.now();
        if (isExpired) {
          throw createServiceError(
            "Seat reservation is expiring. Please try again shortly.",
            409,
          );
        }
        return {
          booking: existingBooking,
          fareAmount: existingBooking.fareAmount,
          currency: existingBooking.currency,
        };
      }

      const allocatedSeat = await this.allocateLowestAvailableSeat(
        tx,
        tripRecord.id,
      );

      let newBooking: BookingRecord;
      try {
        newBooking = await this.repo.insertBooking(tx, {
          tripId: tripRecord.id,
          userId,
          seatNumber: allocatedSeat.seatNumber,
          firstName: passengerRecord.firstName,
          lastName: passengerRecord.lastName,
          fareAmount: routeRecord.price,
          currency: "NGN",
          status: "pending",
          expiresAt,
        });
      } catch (error) {
        if (isConstraintError(error, "booking_trip_id_user_id_active_idx")) {
          throw createServiceError(
            "You already have an active booking for this trip",
            409,
          );
        }
        throw error;
      }

      await tx
        .update(trip)
        .set({
          bookedSeats: allocatedSeat.activeBookingCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(trip.id, allocatedSeat.trip.id));

      return {
        booking: newBooking,
        fareAmount: newBooking.fareAmount,
        currency: newBooking.currency,
      };
    });

    logger.info("booking.created", {
      bookingId: result.booking.id,
      tripId: result.booking.tripId,
      seatNumber: result.booking.seatNumber,
      expiresAt: result.booking.expiresAt?.toISOString(),
    });

    return result;
  }
}
