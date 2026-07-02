import { createServiceError } from "@shared/utils";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "../db/connection";
import { driver, externalDriver, trip, vehicle } from "../db/index";
import { logger } from "../utils/logger";
import { addDaysToDateKey, formatBusinessDate, getBusinessDayWindow, getScheduledDepartureTime } from "../utils/route";
import { formatRouteDate } from "../utils/timezone";
import { notificationService } from "../notification/notification.service";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { jobService } from "../workers/job.service";
import { RouteRepository, routeRepository } from "./route.repository";
import { sseManager } from "./sse-manager";
import { decodeCursor, encodeCursor, normalizePageLimit } from "./utils";

interface AvailableTripsCursor {
  date: string;
  id: string;
}

function isValidAvailableTripsCursor(value: unknown): value is AvailableTripsCursor {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return typeof c.date === "string" && typeof c.id === "string";
}

export class TripClaimService {
  constructor(private repo: RouteRepository) {}

  async getAvailableTrips(limit?: number, cursor?: string, search?: string, date?: string) {
    const parsedLimit = normalizePageLimit(limit);
    const decodedCursor = decodeCursor<AvailableTripsCursor>(
      cursor,
      isValidAvailableTripsCursor,
    );

    const repoCursor = decodedCursor
      ? { date: new Date(decodedCursor.date), id: decodedCursor.id }
      : null;

    const conditions = [eq(trip.status, "awaiting_driver"), isNull(trip.driverId)];

    if (date) {
      const { start, end } = getBusinessDayWindow(date);
      conditions.push(gte(trip.date, start), lt(trip.date, end));
    }

    const result = await this.repo.findTripsWithRouteAndBookingCount(
      conditions,
      parsedLimit,
      repoCursor,
      search,
    );

    const trips = result.rows.map(({ trip: t, route: r, confirmedBookingCount }) => ({
      tripId: t.id,
      date: t.date,
      capacity: t.capacity,
      bookedSeats: t.bookedSeats,
      confirmedBookingCount,
      vehicleType: t.vehicleType,
      route: {
        id: r.id,
        pickup_location_title: r.pickup_location_title,
        pickup_location_locality: r.pickup_location_locality,
        pickup_location_label: r.pickup_location_label,
        dropoff_location_title: r.dropoff_location_title,
        dropoff_location_locality: r.dropoff_location_locality,
        dropoff_location_label: r.dropoff_location_label,
        departure_time: r.departure_time,
        arrival_time: r.arrival_time,
        priceCar: r.priceCar,
        priceBus: r.priceBus,
        meeting_point: r.meeting_point,
      },
    }));

    return {
      trips,
      nextCursor: result.nextCursor
        ? encodeCursor({
            date: result.nextCursor.date.toISOString(),
            id: result.nextCursor.id,
          })
        : null,
    };
  }

  async getAvailableTripsCountByDate(startDate: string, endDate: string) {
    const { start } = getBusinessDayWindow(startDate);
    const { start: rangeEnd } = getBusinessDayWindow(addDaysToDateKey(endDate, 1));
    const rows = await this.repo.countAvailableTripsByDateRange(start, rangeEnd);

    const countMap: Record<string, number> = {};
    for (const row of rows) {
      const dateKey = formatBusinessDate(row.date);
      countMap[dateKey] = (countMap[dateKey] || 0) + 1;
    }
    return { counts: countMap };
  }

  async claimTrip(driverId: string, tripId: string, vehicleId: string) {
    const tripWithRoute = await this.repo.findTripWithRoute(tripId);
    if (!tripWithRoute) {
      throw createServiceError("Trip not found", 404);
    }

    const { trip: tripRecord, route: routeRecord } = tripWithRoute;

    if (tripRecord.driverId) {
      throw createServiceError("This trip already has a driver assigned", 409);
    }
    if (tripRecord.status === "cancelled") {
      throw createServiceError("This trip has been cancelled", 400);
    }
    if (tripRecord.status === "completed") {
      throw createServiceError("This trip has been completed", 400);
    }

    const dateKey = formatBusinessDate(tripRecord.date);
    const scheduledDeparture = getScheduledDepartureTime(
      dateKey,
      routeRecord.departure_time,
    );
    if (scheduledDeparture <= new Date()) {
      throw createServiceError(
        "This trip has already departed and can no longer be claimed",
        400,
      );
    }

    let notificationRecord: Awaited<ReturnType<typeof notificationService.createForDriverInTransaction>> | undefined;

    await db.transaction(async (tx) => {
      const [lockedDriver] = await tx
        .select()
        .from(driver)
        .where(eq(driver.id, driverId))
        .for("update");

      if (!lockedDriver) {
        throw createServiceError("Driver not found", 404);
      }
      if (!lockedDriver.isActive) {
        throw createServiceError("Driver account is deactivated", 403);
      }
      if (lockedDriver.bankVerificationStatus !== "active") {
        throw createServiceError("Driver bank account must be verified before claiming trips", 403);
      }
      if (lockedDriver.kycStatus !== "active") {
        throw createServiceError("Identity verification (KYC) must be completed before claiming trips", 403);
      }

      const lockedTrip = await this.repo.lockTrip(tx, tripId);
      if (!lockedTrip) {
        throw createServiceError("Trip not found", 404);
      }
      if (lockedTrip.driverId) {
        throw createServiceError("This trip already has a driver assigned", 409);
      }
      if (lockedTrip.status === "cancelled") {
        throw createServiceError("This trip has been cancelled", 400);
      }
      if (lockedTrip.status === "completed") {
        throw createServiceError("This trip has been completed", 400);
      }

      const existingExternal = await tx.query.externalDriver.findFirst({
        where: eq(externalDriver.tripId, tripId),
      });
      if (existingExternal) {
        throw createServiceError("This trip already has an external driver assigned", 409);
      }

      const [lockedVehicle] = await tx
        .select()
        .from(vehicle)
        .where(eq(vehicle.id, vehicleId))
        .for("update");
      if (!lockedVehicle) {
        throw createServiceError("Vehicle not found", 404);
      }
      if (lockedVehicle.driverId !== driverId) {
        throw createServiceError("Vehicle does not belong to this driver", 403);
      }
      const conflict = await this.repo.findVehicleScheduledAtDeparture(
        tx,
        driverId,
        vehicleId,
        tripRecord.date,
        routeRecord.departure_time,
        tripId,
      );
      if (conflict) {
        throw createServiceError(
          "This vehicle is already scheduled for another trip at this departure time",
          409,
        );
      }

      if (lockedVehicle.capacity < tripRecord.capacity) {
        throw createServiceError(
          `Vehicle capacity (${lockedVehicle.capacity}) is insufficient for this trip (${tripRecord.capacity})`,
          400,
        );
      }

      const updated = await this.repo.assignDriverToTrip(tx, tripId, driverId, vehicleId);
      if (!updated) {
        throw createServiceError("Failed to claim trip", 500);
      }

      notificationRecord = await notificationService.createForDriverInTransaction(
        tx,
        driverId,
        {
          notificationKey: `trip:${tripId}:claimed`,
          kind: "event",
          type: "trip_claimed",
          title: "Trip claimed successfully",
          message: `You have claimed the trip from ${routeRecord.pickup_location_title} to ${routeRecord.dropoff_location_title} on ${formatRouteDate(tripRecord.date)}.`,
          href: `/trips/${tripId}`,
          tag: "Claimed",
          tone: "positive",
          metadata: {
            tripId,
            routeId: routeRecord.id,
            pickupTitle: routeRecord.pickup_location_title,
            dropoffTitle: routeRecord.dropoff_location_title,
            departureTime: routeRecord.departure_time,
          },
          occurredAt: new Date(),
        },
      );

      await jobService.enqueue(tx, "trip.driver_assigned", {
        tripId,
        driverId,
        vehicleId,
      });
    });

    if (notificationRecord) {
      publishNotificationCreatedInBackground(notificationRecord);
    }

    sseManager.broadcast("trip_claimed", {
      tripId,
      routeId: routeRecord.id,
      bookedSeats: tripRecord.bookedSeats,
      capacity: tripRecord.capacity,
      vehicleType: tripRecord.vehicleType,
    });

    logger.info("trip.claimed", { tripId, driverId, vehicleId });
    return { tripId, status: "confirmed" as const };
  }
}

export const tripClaimService = new TripClaimService(routeRepository);
