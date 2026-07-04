import type { JWTPayload } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { and, asc, eq, getTableColumns, gte, inArray, lt, ne, notInArray, sql } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, route, trip } from "../db/index";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import {
    addDaysToDateKey,
    formatBusinessDate,
    getBusinessDayWindow,
    HIDDEN_BOOKING_PAYMENT_STATUSES,
} from "../utils/route";
import { RouteRepository, routeRepository } from "./route.repository";
import { payoutService as sharedPayoutService } from "../payout/payout.service";
import { getTripArrivalAt, resolveDriverId, VISIBLE_BOOKING_STATUSES } from "./utils";
import { logger } from "../utils/logger";

export class TripService {
  private readonly payoutService = sharedPayoutService;

  constructor(private repo: RouteRepository) {}

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
      const lockedTrip = await this.repo.lockTrip(tx, tripId);
      if (!lockedTrip) {
        throw createServiceError("Trip not found", 404);
      }
      if (lockedTrip.driverId !== driverId) {
        throw createServiceError(
          "You are not authorized to complete this trip",
          403,
        );
      }
      if (lockedTrip.status === "cancelled") {
        throw createServiceError("Cancelled trips cannot be completed", 400);
      }
      if (lockedTrip.status === "completed") {
        throw createServiceError("Trip is already completed", 400);
      }

      const updatedTrip = await this.repo.updateTrip(tx, tripId, {
        status: "completed",
        vehicleId: null,
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
        pickup_location_label: row.route.pickup_location_label,
        pickup_location_locality: row.route.pickup_location_locality,
        dropoff_location_title: row.route.dropoff_location_title,
        dropoff_location_label: row.route.dropoff_location_label,
        dropoff_location_locality: row.route.dropoff_location_locality,
        priceCar: row.route.priceCar,
        priceBus: row.route.priceBus,
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

export const tripService = new TripService(routeRepository);
