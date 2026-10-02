import type { CreateBooking } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { and, desc, eq, getTableColumns, lt, or, sql } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, driver, earning, origin, destination, payment, refund, trip } from "../db/index";
import { logger } from "../utils/logger";
import { scheduledAtSql } from "../utils/db-datetime";
import { parseDateKey } from "../utils/route";
import { RouteRepository } from "./route.repository";
import {
  normalizePageLimit,
  decodeCursor,
  encodeCursor,
  isValidUserBookingsCursor,
} from "./utils";

export class BookingService {
  constructor(private repo: RouteRepository) {}

  async createCheckoutBooking(userId: string, input: CreateBooking) {
    const passengerRecord = await this.repo.findUserById(userId);
    if (!passengerRecord) {
      throw createServiceError("Passenger not found", 404);
    }

    const originRecord = await this.repo.findOriginById(input.originId);
    if (!originRecord) throw createServiceError("Origin not found", 404);
    if (originRecord.status !== "active") {
      throw createServiceError("Route is not open for booking", 400);
    }

    const dest = await this.repo.findDestinationById(input.destinationId);
    if (!dest) throw createServiceError("Destination not found", 404);
    if (dest.status !== "active") {
      throw createServiceError("Destination is not available for this origin", 400);
    }
    if (!(originRecord.destinationIds || []).includes(dest.id)) {
      throw createServiceError("Destination is not available for this origin", 400);
    }

    if (!(originRecord.departureTime || []).includes(input.departureTime)) {
      throw createServiceError("Selected departure time is not available for this route", 400);
    }

    const tripDate = parseDateKey(input.tripDate);
    if (await this.repo.hasTripSlotDeparted(tripDate, input.departureTime)) {
      throw createServiceError(
        "This trip has already departed and can no longer be booked",
        400,
      );
    }

    const luggageCount = input.passengers.filter(
      (traveler) => traveler.carriesLuggage,
    ).length;
    const passengerCount = input.passengers.length;
    const totalAmount =
      originRecord.price * passengerCount +
      luggageCount * (originRecord.luggageFee ?? 0);
    const totalFee = originRecord.fee * passengerCount;

    const newBooking = await db.transaction(async (tx) => {
      const created = await this.repo.insertBooking(tx, {
        originId: originRecord.id,
        destinationId: dest.id,
        tripDate,
        departureTime: input.departureTime,
        luggageCount,
        userId,
        totalAmount,
        totalFee,
        currency: "NGN",
        status: "pending",
      });

      await this.repo.insertPassengers(
        tx,
        input.passengers.map((traveler) => ({
          bookingId: created.id,
          fullName: traveler.fullName,
          email: traveler.email,
          phone: traveler.phone,
          carriesLuggage: traveler.carriesLuggage,
        })),
      );

      return created;
    });

    logger.info("booking.created", {
      bookingId: newBooking.id,
      originId: newBooking.originId,
      destinationId: newBooking.destinationId,
      userId,
      passengerCount,
      luggageCount,
      departureTime: newBooking.departureTime,
      totalAmount: newBooking.totalAmount,
      totalFee: newBooking.totalFee,
    });

    return {
      booking: newBooking,
      origin: originRecord,
      destination: dest,
      totalAmount: newBooking.totalAmount,
      totalFee: newBooking.totalFee,
      currency: newBooking.currency,
    };
  }

  async getUserBookings(userId: string, limit = 20, cursor?: string) {
    const parsedLimit = normalizePageLimit(limit);
    const decodedCursor = decodeCursor(cursor, isValidUserBookingsCursor);
    const visibleBookingConditions = and(
      eq(booking.userId, userId),
      eq(booking.status, "confirmed"),
      eq(payment.status, "successful"),
    );
    const cursorCondition = decodedCursor
      ? or(
          lt(booking.tripDate, decodedCursor.tripDate),
          and(
            eq(booking.tripDate, decodedCursor.tripDate),
            lt(booking.id, decodedCursor.id),
          ),
        )
      : undefined;

    const baseQuery = db
      .select({
        booking: getTableColumns(booking),
        trip: trip,
        origin: origin,
        destination: destination,
        driver: driver,
        earning: earning,
        paymentStatus: payment.status,
        refundStatus: refund.status,
        hasDeparted: sql<boolean>`${scheduledAtSql(trip.date, trip.departureTime)} <= now()`,
      })
      .from(booking)
      .innerJoin(payment, eq(payment.bookingId, booking.id))
      .leftJoin(refund, eq(refund.id, payment.refundId))
      .leftJoin(trip, eq(trip.id, booking.tripId))
      .leftJoin(origin, eq(origin.id, booking.originId))
      .leftJoin(destination, eq(destination.id, booking.destinationId))
      .leftJoin(driver, eq(driver.id, trip.driverId))
      .leftJoin(earning, eq(earning.tripId, trip.id))
      .where(cursorCondition ? and(visibleBookingConditions, cursorCondition) : visibleBookingConditions)
      .orderBy(desc(booking.tripDate), desc(booking.id))
      .limit(parsedLimit + 1);

    const rows = await baseQuery;

    const hasMore = rows.length > parsedLimit;
    const sliced = hasMore ? rows.slice(0, parsedLimit) : rows;
    const last = sliced[sliced.length - 1];

    const nextCursor = hasMore && last
      ? encodeCursor({
          tripDate: last.booking.tripDate,
          id: last.booking.id,
        })
      : undefined;

    return {
      bookings: sliced.map((row) => ({
        ...row.booking,
        paymentStatus: row.paymentStatus,
        refundStatus: row.refundStatus ?? null,
        trip: row.trip
          ? {
              ...row.trip,
              origin: row.origin,
              destination: row.destination,
              driver: row.driver,
              earnings: row.earning?.amount ?? 0,
            }
          : null,
        hasDeparted: Boolean(row.hasDeparted),
      })),
      nextCursor,
    };
  }

  async getTripBookings(user: any, tripId: string) {
    const driverId = await (await import("./utils")).resolveDriverId(user);
    const t = await this.repo.findTripWithOriginDestination(tripId);
    if (!t) throw new Error("Trip not found");
    if (t.trip.driverId !== driverId) throw new Error("Forbidden");
    const bookings = await db
      .select({ booking: getTableColumns(booking) })
      .from(booking)
      .where(eq(booking.tripId, tripId))
      .orderBy(desc(booking.createdAt));
    return bookings.map((b) => ({ ...b.booking }));
  }
}
export const bookingService = new BookingService(new RouteRepository());
