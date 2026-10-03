import type { CreateBooking, JWTPayload } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, driver, origin, destination, payment, refund, trip } from "../db/index";
import { logger } from "../utils/logger";
import { parseDateKey } from "../utils/route";
import { RouteRepository } from "./route.repository";

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
    const cap = Math.max(1, Math.min(50, Math.floor(limit || 20)));
    const decoded = cursor ? this.decodeCursor(cursor) : null;

    const rows = await db
      .select({
        id: booking.id,
        tripId: booking.tripId,
        tripDate: booking.tripDate,
        departureTime: booking.departureTime,
        totalAmount: booking.totalAmount,
        totalFee: booking.totalFee,
        refundStatus: refund.status,
        trip,
        originTitle: origin.title,
        destinationTitle: destination.title,
        driverId: driver.id,
        driverFirstName: driver.firstName,
        driverLastName: driver.lastName,
        driverPhone: driver.phone,
        driverProfilePic: driver.profile_pic,
      })
      .from(booking)
      .innerJoin(payment, eq(payment.bookingId, booking.id))
      .leftJoin(refund, eq(refund.id, payment.refundId))
      .leftJoin(trip, eq(trip.id, booking.tripId))
      .leftJoin(origin, eq(origin.id, booking.originId))
      .leftJoin(destination, eq(destination.id, booking.destinationId))
      .leftJoin(driver, eq(driver.id, trip.driverId))
      .where(
        and(
          eq(booking.userId, userId),
          eq(booking.status, "confirmed"),
          eq(payment.status, "successful"),
          decoded
            ? or(
                lt(booking.tripDate, decoded.tripDate),
                and(
                  eq(booking.tripDate, decoded.tripDate),
                  lt(booking.id, decoded.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(booking.tripDate), desc(booking.id))
      .limit(cap + 1);

    const hasMore = rows.length > cap;
    const page = hasMore ? rows.slice(0, cap) : rows;
    const last = page.at(-1);

    return {
      bookings: page.map((r) => ({
        id: r.id,
        tripId: r.tripId,
        tripDate: r.tripDate,
        departureTime: r.departureTime,
        totalAmount: r.totalAmount,
        totalFee: r.totalFee,
        refundStatus: r.refundStatus ?? null,
        trip: r.trip
          ? {
              capacity: r.trip.capacity,
              bookedSeats: r.trip.bookedSeats,
              origin: { title: r.originTitle ?? "" },
              destination: { title: r.destinationTitle ?? "" },
              driver: r.driverId
                ? {
                    id: r.driverId,
                    firstName: r.driverFirstName ?? "",
                    lastName: r.driverLastName ?? "",
                    phone: r.driverPhone ?? "",
                    profilePic: r.driverProfilePic ?? null,
                  }
                : null,
            }
          : null,
      })),
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ tripDate: last.tripDate, id: last.id }),
            ).toString("base64url")
          : undefined,
    };
  }

  private decodeCursor(cursor: string): { tripDate: string; id: string } {
    try {
      const v = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (
        v &&
        typeof v === "object" &&
        typeof v.tripDate === "string" &&
        typeof v.id === "string"
      ) {
        return v;
      }
    } catch {}
    throw createServiceError("Invalid cursor", 400, "INVALID_CURSOR");
  }

  async getTripPassengers(user: JWTPayload, tripId: string) {
    const [isBooker, isDriver] = await Promise.all([
      this.repo.hasConfirmedBookingOnTrip(user.userId, tripId),
      this.repo.isDriverForTrip(user.userId, tripId),
    ]);

    if (!isBooker && !isDriver) {
      throw createServiceError("Trip not found", 404, "TRIP_NOT_FOUND");
    }

    const passengers = await this.repo.findTripPassengersForTrip(tripId);
    return { passengers };
  }
}
export const bookingService = new BookingService(new RouteRepository());
