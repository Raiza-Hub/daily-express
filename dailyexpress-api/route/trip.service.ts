import type { JWTPayload } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { and, asc, eq, getTableColumns, gte, inArray, lt, ne, notInArray, sql } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, route, trip } from "../db/index";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { PayoutService } from "../payout/payoutService";
import {
    addDaysToDateKey,
    formatBusinessDate,
    getBusinessDayWindow,
    HIDDEN_BOOKING_PAYMENT_STATUSES,
} from "../utils/route";
import { RouteRepository } from "./route.repository";
import { getTripArrivalAt, resolveDriverId } from "./utils";

export class TripService {
  private readonly payoutService = new PayoutService();

  constructor(private repo: RouteRepository) {}

  async updateTripStatus(
    user: JWTPayload,
    tripId: string,
    status: "booking_closed",
  ) {
    const driverId = await resolveDriverId(user);
    const tripExists = await this.repo.findTripById(tripId);
    if (!tripExists) {
      throw createServiceError("Trip not found", 404);
    }
    if (tripExists.driverId !== driverId) {
      throw createServiceError(
        "You are not authorized to update this trip",
        403,
      );
    }
    if (tripExists.bookedSeats >= tripExists.capacity) {
      throw createServiceError("Cannot stop booking - trip is full", 400);
    }

    const updatedTrip = await this.repo.updateTripStandalone(tripId, {
      status,
      updatedAt: new Date(),
    });

    return updatedTrip;
  }

  async completeTrip(user: JWTPayload, tripId: string) {
    const driverId = await resolveDriverId(user);
    const tripWithRoute = await this.repo.findTripWithRoute(tripId);

    if (!tripWithRoute) {
      throw createServiceError("Trip not found", 404);
    }
    if (tripWithRoute.trip.driverId !== driverId) {
      throw createServiceError(
        "You are not authorized to complete this trip",
        403,
      );
    }
    if (tripWithRoute.trip.status === "cancelled") {
      throw createServiceError("Cancelled trips cannot be completed", 400);
    }
    if (tripWithRoute.trip.status === "completed") {
      throw createServiceError("Trip is already completed", 400);
    }

    const arrivalAt = getTripArrivalAt(tripWithRoute.trip, tripWithRoute.route);
    if (arrivalAt.getTime() > Date.now()) {
      throw createServiceError(
        "Trip cannot be completed before the scheduled arrival time",
        400,
      );
    }

    const result = await db.transaction(async (tx) => {
      const updatedTrip = await this.repo.updateTrip(tx, tripId, {
        status: "completed",
        updatedAt: new Date(),
      });
      if (!updatedTrip) {
        throw createServiceError("Trip not found", 404);
      }

      await this.repo.updateBookingsByTrip(
        tx,
        tripId,
        { status: "completed", updatedAt: new Date() },
        [
          eq(booking.status, "confirmed"),
          notInArray(booking.paymentStatus, HIDDEN_BOOKING_PAYMENT_STATUSES),
        ],
      );

      const payoutResult = await this.payoutService.markTripCompletedInTransaction(
        tx,
        { tripId, completedAt: new Date() },
      );

      return {
        updatedTrip,
        pendingNotifications: payoutResult.pendingNotifications,
      };
    });

    for (const notification of result.pendingNotifications) {
      publishNotificationCreatedInBackground(notification);
    }

    return result.updatedTrip;
  }

  async getDailyTripSummaries(
    user: JWTPayload,
    startDate: string,
    endDate: string,
  ) {
    const driverId = await resolveDriverId(user);
    const { start } = getBusinessDayWindow(startDate);
    const { start: rangeEnd } = getBusinessDayWindow(
      addDaysToDateKey(endDate, 1),
    );

    const VISIBLE_BOOKING_STATUSES = ["confirmed", "completed"] as const;

    const bookingTotals = db
      .select({
        tripId: booking.tripId,
        visibleBookedSeats: sql<number>`count(*)::int`.as(
          "visible_booked_seats",
        ),
        earnings: sql<number>`coalesce(sum(${booking.fareAmount}), 0)::bigint`
          .mapWith(Number)
          .as("earnings"),
      })
      .from(booking)
      .where(
        and(
          inArray(booking.status, [...VISIBLE_BOOKING_STATUSES]),
          notInArray(booking.paymentStatus, HIDDEN_BOOKING_PAYMENT_STATUSES),
        ),
      )
      .groupBy(booking.tripId)
      .as("booking_totals");

    const tripRows = await db
      .select({
        trip: getTableColumns(trip),
        route: getTableColumns(route),
        visibleBookedSeats: bookingTotals.visibleBookedSeats,
        earnings: bookingTotals.earnings,
      })
      .from(trip)
      .innerJoin(route, eq(trip.routeId, route.id))
      .innerJoin(bookingTotals, eq(bookingTotals.tripId, trip.id))
      .where(
        and(
          eq(trip.driverId, driverId),
          gte(trip.date, start),
          lt(trip.date, rangeEnd),
          ne(trip.status, "cancelled"),
        ),
      )
      .orderBy(asc(trip.date));

    const tripsWithDetails = tripRows.map((row) => ({
      id: row.trip.id,
      date: row.trip.date,
      bookedSeats: row.visibleBookedSeats,
      capacity: row.trip.capacity,
      status: row.trip.status,
      route: {
        id: row.route.id,
        pickup_location_title: row.route.pickup_location_title,
        pickup_location_locality: row.route.pickup_location_locality,
        dropoff_location_title: row.route.dropoff_location_title,
        dropoff_location_locality: row.route.dropoff_location_locality,
        price: row.route.price,
        departure_time: row.route.departure_time,
        arrival_time: row.route.arrival_time,
      },
      earnings: row.earnings,
    }));

    const groupedByDate = tripsWithDetails.reduce(
      (acc, tripRecord) => {
        const dateKey = formatBusinessDate(tripRecord.date);
        if (!acc[dateKey]) {
          acc[dateKey] = {
            date: dateKey,
            totalEarnings: 0,
            totalTrips: 0,
            totalPassengers: 0,
            trips: [],
          };
        }
        acc[dateKey].totalTrips += 1;
        acc[dateKey].totalPassengers += tripRecord.bookedSeats;
        acc[dateKey].totalEarnings += tripRecord.earnings;
        acc[dateKey].trips.push(tripRecord);
        return acc;
      },
      {} as Record<
        string,
        {
          date: string;
          totalEarnings: number;
          totalTrips: number;
          totalPassengers: number;
          trips: typeof tripsWithDetails;
        }
      >,
    );

    return Object.values(groupedByDate).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }
}
