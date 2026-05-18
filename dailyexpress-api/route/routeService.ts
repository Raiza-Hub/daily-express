import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  lt,
  ne,
  notInArray,
  sql,
} from "drizzle-orm";
import type {
  Booking,
  CreateRoute,
  JWTPayload,
  Route,
  updateRouteRequest,
} from "@shared/types";
import { logger } from "../utils/logger";
import { createServiceError } from "@shared/utils";
import { db } from "../db/connection";
import { booking, driver, route, trip, users } from "../db/index";
import { DriverService } from "../driver/driverService";
import { PaymentService } from "../payment/paymentService";
import { PayoutService } from "../payout/payoutService";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { timeAsync } from "../utils/timing";
import {
  addDaysToDateKey,
  createNormalizedSearchScore,
  formatBusinessDate,
  getBusinessDayWindow,
  getScheduledDepartureTime,
  HIDDEN_BOOKING_PAYMENT_STATUSES,
  isConstraintError,
  isVisibleBooking,
  mapDriverToRouteDriver,
  mapPassenger,
  normalizeSearchText,
} from "../utils/route";

const ALLOWED_VEHICLE_TYPES = ["car", "bus", "luxury car"] as const;
const ROUTE_DUPLICATE_CONSTRAINT =
  "route_driver_origin_destination_departure_unique_idx";
const ACTIVE_BOOKING_CONSTRAINT = "booking_trip_id_user_id_active_idx";
const ROUTE_SEARCH_SCORE_THRESHOLD = 0.15;
const BOOKABLE_TRIP_STATUSES = new Set(["pending", "confirmed"]);
const VISIBLE_BOOKING_STATUSES = ["confirmed", "completed"] as const;

type VehicleType = (typeof ALLOWED_VEHICLE_TYPES)[number];
type RouteRecord = typeof route.$inferSelect;
type BookingRecord = typeof booking.$inferSelect;
type TripRecord = typeof trip.$inferSelect;
type RouteTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type CreateBookingInput = {
  routeId: string;
  tripDate: string;
};

const driverService = new DriverService();
const paymentService = new PaymentService();
const payoutService = new PayoutService();

function getTripArrivalAt(tripRecord: TripRecord, routeRecord: RouteRecord) {
  const dateKey = formatBusinessDate(tripRecord.date);
  const departureAt = getScheduledDepartureTime(
    dateKey,
    routeRecord.departure_time,
  );
  const arrivalAt = getScheduledDepartureTime(
    dateKey,
    routeRecord.arrival_time,
  );

  if (arrivalAt <= departureAt) {
    return new Date(arrivalAt.getTime() + 24 * 60 * 60 * 1000);
  }

  return arrivalAt;
}

export class RouteService {
  private async allocateLowestAvailableSeat(
    tx: RouteTransaction,
    tripId: string,
  ): Promise<{
    trip: TripRecord;
    seatNumber: number;
    activeBookingCount: number;
  }> {
    const [lockedTrip] = await tx
      .select()
      .from(trip)
      .where(eq(trip.id, tripId))
      .for("update")
      .limit(1);

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

  private async getPassengerByUserId(userId: string) {
    return (
      (await db.query.users.findFirst({
        where: eq(users.id, userId),
      })) ?? null
    );
  }

  private async getPassengersByUserIds(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, ReturnType<typeof mapPassenger>>();
    }

    const passengerRecords = await db.query.users.findMany({
      where: inArray(users.id, userIds),
    });

    return new Map(
      passengerRecords.map((record) => [record.id, mapPassenger(record)]),
    );
  }

  private async getDriverByDriverId(driverId: string) {
    return (
      (await db.query.driver.findFirst({
        where: eq(driver.id, driverId),
      })) ?? null
    );
  }

  private async getDriverViewsByDriverIds(driverIds: string[]) {
    if (driverIds.length === 0) {
      return new Map<string, Route["driver"]>();
    }

    const driverRecords = await db.query.driver.findMany({
      where: inArray(driver.id, driverIds),
    });

    return new Map(
      driverRecords.map((record) => [
        record.id,
        mapDriverToRouteDriver(record),
      ]),
    );
  }

  private async resolveDriverRecord(user: JWTPayload) {
    const driverRecord = await db.query.driver.findFirst({
      where: eq(driver.userId, user.userId),
    });

    if (!driverRecord) {
      throw createServiceError("Driver not found", 404);
    }

    return driverRecord;
  }

  private async resolveDriverId(user: JWTPayload): Promise<string> {
    const driverRecord = await this.resolveDriverRecord(user);
    return driverRecord.id;
  }

  private async findRouteConflict(input: {
    driverId: string;
    pickup_location_title: string;
    pickup_location_locality: string;
    pickup_location_label: string;
    dropoff_location_title: string;
    dropoff_location_locality: string;
    dropoff_location_label: string;
    departure_time: Date;
    excludeRouteId?: string;
  }): Promise<RouteRecord | null> {
    const conditions = [
      eq(route.driverId, input.driverId),
      eq(route.pickup_location_title, input.pickup_location_title),
      eq(route.pickup_location_locality, input.pickup_location_locality),
      eq(route.pickup_location_label, input.pickup_location_label),
      eq(route.dropoff_location_title, input.dropoff_location_title),
      eq(route.dropoff_location_locality, input.dropoff_location_locality),
      eq(route.dropoff_location_label, input.dropoff_location_label),
      eq(route.departure_time, input.departure_time),
    ];

    if (input.excludeRouteId) {
      conditions.push(ne(route.id, input.excludeRouteId));
    }

    return (
      (await db.query.route.findFirst({
        where: and(...conditions),
      })) ?? null
    );
  }

  private async buildRouteResponse(
    record: RouteRecord,
    remainingSeats = record.availableSeats,
    driverRecord?: typeof driver.$inferSelect | null,
  ): Promise<Route> {
    const routeDriverRecord =
      driverRecord ?? (await this.getDriverByDriverId(record.driverId));

    if (!routeDriverRecord) {
      throw createServiceError("Driver not found", 404);
    }

    return {
      ...record,
      remainingSeats,
      driver: mapDriverToRouteDriver(routeDriverRecord),
    };
  }

  async createRoute(user: JWTPayload, routeData: CreateRoute): Promise<Route> {
    const driverRecord = await this.resolveDriverRecord(user);

    const existingRoute = await this.findRouteConflict({
      driverId: driverRecord.id,
      pickup_location_title: routeData.pickup_location_title,
      pickup_location_locality: routeData.pickup_location_locality,
      pickup_location_label: routeData.pickup_location_label,
      dropoff_location_title: routeData.dropoff_location_title,
      dropoff_location_locality: routeData.dropoff_location_locality,
      dropoff_location_label: routeData.dropoff_location_label,
      departure_time: routeData.departure_time,
    });

    if (existingRoute) {
      throw createServiceError("Route already exists", 400);
    }

    let newRoute: RouteRecord;
    try {
      newRoute = await db.transaction(async (tx) => {
        const [record] = await tx
          .insert(route)
          .values({ ...routeData, driverId: driverRecord.id })
          .returning();

        await driverService.recordRouteCreated(tx, driverRecord.id);
        return record;
      });
    } catch (error) {
      if (isConstraintError(error, ROUTE_DUPLICATE_CONSTRAINT)) {
        throw createServiceError("Route already exists", 400);
      }
      throw error;
    }

    return this.buildRouteResponse(
      newRoute,
      newRoute.availableSeats,
      driverRecord,
    );
  }

  async getAllDriverRoutes(user: JWTPayload): Promise<Route[]> {
    const driverRecord = await this.resolveDriverRecord(user);
    const routes = await db.query.route.findMany({
      where: eq(route.driverId, driverRecord.id),
      orderBy: [desc(route.createdAt)],
    });

    return routes.map((record) => ({
      ...record,
      remainingSeats: record.availableSeats,
      driver: mapDriverToRouteDriver(driverRecord),
    }));
  }

  async searchRoutes(params: {
    from: string;
    to: string;
    date: string;
    vehicleType?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Route[]> {
    const { from, to, date, vehicleType, limit = 20, offset = 0 } = params;
    const parsedFrom = from.trim();
    const parsedTo = to.trim();
    const normalizedFrom = parsedFrom ? normalizeSearchText(parsedFrom) : "";
    const normalizedTo = parsedTo ? normalizeSearchText(parsedTo) : "";
    const parsedVehicleType = vehicleType?.filter(
      (value): value is VehicleType =>
        ALLOWED_VEHICLE_TYPES.includes(value as VehicleType),
    );

    if (!parsedFrom || !parsedTo) {
      throw createServiceError("from and to are required", 400);
    }

    if (!date.trim()) {
      throw createServiceError("date is required", 400);
    }

    const { start, end } = getBusinessDayWindow(date);

    const pickupTitleScore = createNormalizedSearchScore(
      route.pickup_location_title,
      parsedFrom,
      normalizedFrom,
    );
    const pickupLabelScore = createNormalizedSearchScore(
      route.pickup_location_label,
      parsedFrom,
      normalizedFrom,
    );
    const pickupLocalityScore = createNormalizedSearchScore(
      route.pickup_location_locality,
      parsedFrom,
      normalizedFrom,
    );
    const dropoffTitleScore = createNormalizedSearchScore(
      route.dropoff_location_title,
      parsedTo,
      normalizedTo,
    );
    const dropoffLabelScore = createNormalizedSearchScore(
      route.dropoff_location_label,
      parsedTo,
      normalizedTo,
    );
    const dropoffLocalityScore = createNormalizedSearchScore(
      route.dropoff_location_locality,
      parsedTo,
      normalizedTo,
    );
    const pickupScore = sql<number>`greatest(
      ${pickupTitleScore},
      ${pickupLabelScore},
      ${pickupLocalityScore}
    )`;
    const dropoffScore = sql<number>`greatest(
      ${dropoffTitleScore},
      ${dropoffLabelScore},
      ${dropoffLocalityScore}
    )`;
    const combinedScore = sql<number>`${pickupScore} + ${dropoffScore}`;
    const conditions = [eq(route.status, "active")];
    if (parsedVehicleType && parsedVehicleType.length > 0) {
      conditions.push(inArray(route.vehicleType, parsedVehicleType));
    }

    const routesResult = await db
      .select({
        ...getTableColumns(route),
        pickupScore,
        dropoffScore,
        combinedScore,
      })
      .from(route)
      .where(
        and(
          ...conditions,
          gte(pickupScore, ROUTE_SEARCH_SCORE_THRESHOLD),
          gte(dropoffScore, ROUTE_SEARCH_SCORE_THRESHOLD),
        ),
      )
      .orderBy(
        desc(combinedScore),
        desc(pickupScore),
        desc(dropoffScore),
        desc(route.createdAt),
        asc(route.id),
      )
      .limit(limit)
      .offset(offset);

    if (routesResult.length === 0) {
      return [];
    }

    const routeIds = routesResult.map((record) => record.id);
    const driverIds = [
      ...new Set(routesResult.map((record) => record.driverId)),
    ];
    const driverMap = await this.getDriverViewsByDriverIds(driverIds);
    const tripsForDay = await db.query.trip.findMany({
      where: and(
        inArray(trip.routeId, routeIds),
        gte(trip.date, start),
        lt(trip.date, end),
      ),
    });
    const bookedSeatsByRouteId = new Map<string, number>();
    for (const tripRecord of tripsForDay) {
      bookedSeatsByRouteId.set(
        tripRecord.routeId,
        (bookedSeatsByRouteId.get(tripRecord.routeId) ?? 0) +
          (tripRecord.bookedSeats ?? 0),
      );
    }

    return routesResult
      .map((record) => {
        const routeDriver = driverMap.get(record.driverId);
        if (!routeDriver) return null;
        const {
          pickupScore: _pickupScore,
          dropoffScore: _dropoffScore,
          combinedScore: _combinedScore,
          ...routeRecord
        } = record;
        const remainingSeats = Math.max(
          routeRecord.availableSeats -
            (bookedSeatsByRouteId.get(routeRecord.id) ?? 0),
          0,
        );
        if (remainingSeats === 0) return null;
        return {
          ...routeRecord,
          remainingSeats,
          driver: routeDriver,
        };
      })
      .filter((record): record is Route => record !== null);
  }

  async updateRoute(
    user: JWTPayload,
    routeId: string,
    routeData: updateRouteRequest,
  ): Promise<Route> {
    const driverId = await this.resolveDriverId(user);
    const existingRoute = await db.query.route.findFirst({
      where: eq(route.id, routeId),
    });

    if (!existingRoute) {
      throw createServiceError("Route not found", 404);
    }
    if (existingRoute.driverId !== driverId) {
      throw createServiceError(
        "You are not authorized to update this route",
        403,
      );
    }

    const nextRouteValues = {
      pickup_location_title:
        routeData.pickup_location_title ?? existingRoute.pickup_location_title,
      pickup_location_locality:
        routeData.pickup_location_locality ??
        existingRoute.pickup_location_locality,
      pickup_location_label:
        routeData.pickup_location_label ?? existingRoute.pickup_location_label,
      dropoff_location_title:
        routeData.dropoff_location_title ??
        existingRoute.dropoff_location_title,
      dropoff_location_locality:
        routeData.dropoff_location_locality ??
        existingRoute.dropoff_location_locality,
      dropoff_location_label:
        routeData.dropoff_location_label ??
        existingRoute.dropoff_location_label,
      departure_time: routeData.departure_time ?? existingRoute.departure_time,
    };

    const conflictingRoute = await this.findRouteConflict({
      driverId,
      ...nextRouteValues,
      excludeRouteId: routeId,
    });

    if (conflictingRoute) {
      throw createServiceError("Route already exists", 400);
    }

    let updatedRoute: RouteRecord;
    try {
      [updatedRoute] = await db
        .update(route)
        .set({ ...routeData, updatedAt: new Date() })
        .where(eq(route.id, routeId))
        .returning();
    } catch (error) {
      if (isConstraintError(error, ROUTE_DUPLICATE_CONSTRAINT)) {
        throw createServiceError("Route already exists", 400);
      }
      throw error;
    }

    return this.buildRouteResponse(updatedRoute);
  }

  async deleteRoute(user: JWTPayload, routeId: string): Promise<void> {
    const driverId = await this.resolveDriverId(user);
    const existingRoute = await db.query.route.findFirst({
      where: eq(route.id, routeId),
    });

    if (!existingRoute) {
      throw createServiceError("Route not found", 404);
    }
    if (existingRoute.driverId !== driverId) {
      throw createServiceError(
        "You are not authorized to delete this route",
        403,
      );
    }

    await db.transaction(async (tx) => {
      await tx.delete(route).where(eq(route.id, routeId));
      await driverService.recordRouteDeleted(tx, existingRoute.driverId);
    });
  }

  async updateTripStatus(
    user: JWTPayload,
    tripId: string,
    status: "booking_closed",
  ) {
    const driverId = await this.resolveDriverId(user);
    const tripExists = await db.query.trip.findFirst({
      where: eq(trip.id, tripId),
    });
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

    const [updatedTrip] = await db
      .update(trip)
      .set({ status, updatedAt: new Date() })
      .where(eq(trip.id, tripId))
      .returning();

    return updatedTrip;
  }

  async completeTrip(user: JWTPayload, tripId: string) {
    const driverId = await this.resolveDriverId(user);
    const tripExists = await db.query.trip.findFirst({
      where: eq(trip.id, tripId),
    });
    if (!tripExists) {
      throw createServiceError("Trip not found", 404);
    }
    if (tripExists.driverId !== driverId) {
      throw createServiceError(
        "You are not authorized to complete this trip",
        403,
      );
    }
    if (tripExists.status === "cancelled") {
      throw createServiceError("Cancelled trips cannot be completed", 400);
    }
    if (tripExists.status === "completed") {
      throw createServiceError("Trip is already completed", 400);
    }

    const routeRecord = await db.query.route.findFirst({
      where: eq(route.id, tripExists.routeId),
    });
    if (!routeRecord) {
      throw createServiceError("Route not found", 404);
    }

    const arrivalAt = getTripArrivalAt(tripExists, routeRecord);
    if (arrivalAt.getTime() > Date.now()) {
      throw createServiceError(
        "Trip cannot be completed before the scheduled arrival time",
        400,
      );
    }

    const result = await db.transaction(async (tx) => {
      const [updatedTrip] = await tx
        .update(trip)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(trip.id, tripId))
        .returning();
      if (!updatedTrip) {
        throw createServiceError("Trip not found", 404);
      }

      await tx
        .update(booking)
        .set({ status: "completed", updatedAt: new Date() })
        .where(
          and(
            eq(booking.tripId, tripId),
            eq(booking.status, "confirmed"),
            notInArray(booking.paymentStatus, HIDDEN_BOOKING_PAYMENT_STATUSES),
          ),
        );

      const payoutResult = await payoutService.markTripCompletedInTransaction(
        tx,
        {
          tripId,
          completedAt: new Date(),
        },
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

  async getUserBookings(userId: string, limit = 20, offset = 0) {
    const visibleBookingConditions = and(
      eq(booking.userId, userId),
      inArray(booking.status, [...VISIBLE_BOOKING_STATUSES]),
      notInArray(
        booking.paymentStatus,
        // Intentionally omit refund statuses so users see refunded bookings
        ["failed", "cancelled", "expired"],
      ),
    );
    const parsedLimit = Number(limit) || 20;
    const parsedOffset = Number(offset) || 0;
    const bookingRecords = await timeAsync(
      "route.get_user_bookings.query_bookings",
      { userId, limit: parsedLimit, offset: parsedOffset },
      () =>
        db.query.booking.findMany({
          where: visibleBookingConditions,
          limit: parsedLimit,
          offset: parsedOffset,
          orderBy: [desc(booking.createdAt)],
        }),
    );
    const countResult = await timeAsync(
      "route.get_user_bookings.count",
      { userId },
      () =>
        db
          .select({ count: count() })
          .from(booking)
          .where(visibleBookingConditions),
    );
    const total = Number(countResult[0]?.count ?? 0);
    const tripIds = [
      ...new Set(bookingRecords.map((record) => record.tripId).filter(Boolean)),
    ];
    const tripRecords =
      tripIds.length > 0
        ? (
            await timeAsync(
              "route.get_user_bookings.query_trips",
              { userId, tripCount: tripIds.length },
              () =>
                db.query.trip.findMany({ where: inArray(trip.id, tripIds) }),
            )
          ).filter((tripRecord) => tripRecord.status !== "cancelled")
        : [];
    const tripsById = new Map(tripRecords.map((record) => [record.id, record]));
    const routeIds = [...new Set(tripRecords.map((record) => record.routeId))];
    const routeRecords =
      routeIds.length > 0
        ? await timeAsync(
            "route.get_user_bookings.query_routes",
            { userId, routeCount: routeIds.length },
            () =>
              db.query.route.findMany({ where: inArray(route.id, routeIds) }),
          )
        : [];
    const routesById = new Map(
      routeRecords.map((record) => [record.id, record]),
    );
    const driverMap = await this.getDriverViewsByDriverIds([
      ...new Set(routeRecords.map((record) => record.driverId)),
    ]);

    const bookings = bookingRecords
      .filter((record) => tripsById.has(record.tripId))
      .map((bookingRecord) => {
        const tripRecord = tripsById.get(bookingRecord.tripId);
        const routeRecord = tripRecord
          ? routesById.get(tripRecord.routeId)
          : null;
        const routeDriver = routeRecord
          ? (driverMap.get(routeRecord.driverId) ?? null)
          : null;

        return {
          id: bookingRecord.id,
          seatNumber: bookingRecord.seatNumber ?? 0,
          fareAmount: bookingRecord.fareAmount,
          currency: bookingRecord.currency,
          status: bookingRecord.status,
          paymentReference: bookingRecord.paymentReference ?? null,
          paymentStatus: bookingRecord.paymentStatus,
          createdAt: bookingRecord.createdAt,
          updatedAt: bookingRecord.updatedAt,
          tripId: bookingRecord.tripId,
          trip:
            tripRecord && routeRecord
              ? {
                  id: tripRecord.id,
                  date: tripRecord.date,
                  status: tripRecord.status,
                  bookedSeats: tripRecord.bookedSeats,
                  capacity: tripRecord.capacity,
                  availableSeats: Math.max(
                    tripRecord.capacity - tripRecord.bookedSeats,
                    0,
                  ),
                  route: {
                    id: routeRecord.id,
                    pickupLocationTitle: routeRecord.pickup_location_title,
                    pickupLocationLocality:
                      routeRecord.pickup_location_locality,
                    pickupLocationLabel: routeRecord.pickup_location_label,
                    dropoffLocationTitle: routeRecord.dropoff_location_title,
                    dropoffLocationLocality:
                      routeRecord.dropoff_location_locality,
                    dropoffLocationLabel: routeRecord.dropoff_location_label,
                    price: routeRecord.price,
                    vehicleType: routeRecord.vehicleType,
                    meetingPoint: routeRecord.meeting_point,
                    departureTime: routeRecord.departure_time,
                    arrivalTime: routeRecord.arrival_time,
                    driver: routeDriver
                      ? {
                          id: routeDriver.id,
                          firstName: routeDriver.firstName,
                          lastName: routeDriver.lastName,
                          phoneNumber: routeDriver.phone,
                          profilePictureUrl: routeDriver.profile_pic ?? null,
                          country: routeDriver.country,
                          state: routeDriver.state,
                        }
                      : null,
                  },
                }
              : null,
        };
      });

    return { bookings, total };
  }

  async searchBookingByRef(
    userId: string,
    paymentReference: string,
    lastName: string,
  ): Promise<Booking | null> {
    const normalizedLastName = lastName.trim().toLowerCase();
    return (
      (await db.query.booking.findFirst({
        where: and(
          eq(booking.userId, userId),
          eq(booking.paymentReference, paymentReference),
          sql`lower(${booking.lastName}) = ${normalizedLastName}`,
          eq(booking.status, "confirmed"),
        ),
      })) ?? null
    );
  }

  async getTripsSummaryRange(
    user: JWTPayload,
    startDate: string,
    endDate: string,
  ) {
    const driverId = await this.resolveDriverId(user);
    const { start } = getBusinessDayWindow(startDate);
    const { start: rangeEnd } = getBusinessDayWindow(
      addDaysToDateKey(endDate, 1),
    );
    const trips = await db.query.trip.findMany({
      where: and(
        eq(trip.driverId, driverId),
        gte(trip.date, start),
        lt(trip.date, rangeEnd),
        ne(trip.status, "cancelled"),
      ),
      orderBy: [asc(trip.date)],
    });
    const routeRecords =
      trips.length > 0
        ? await db.query.route.findMany({
            where: inArray(route.id, [
              ...new Set(trips.map((currentTrip) => currentTrip.routeId)),
            ]),
          })
        : [];
    const routesById = new Map(
      routeRecords.map((record) => [record.id, record]),
    );
    const bookingRecords =
      trips.length > 0
        ? (
            await db.query.booking.findMany({
              where: and(
                inArray(
                  booking.tripId,
                  trips.map((currentTrip) => currentTrip.id),
                ),
                inArray(booking.status, [...VISIBLE_BOOKING_STATUSES]),
                notInArray(
                  booking.paymentStatus,
                  HIDDEN_BOOKING_PAYMENT_STATUSES,
                ),
              ),
            })
          ).filter(isVisibleBooking)
        : [];
    const visibleBookingsByTripId = bookingRecords.reduce((acc, record) => {
      acc.set(record.tripId, (acc.get(record.tripId) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
    const visibleFareTotalsByTripId = bookingRecords.reduce((acc, record) => {
      acc.set(record.tripId, (acc.get(record.tripId) ?? 0) + record.fareAmount);
      return acc;
    }, new Map<string, number>());

    const tripsWithDetails = trips.flatMap((currentTrip) => {
      const routeData = routesById.get(currentTrip.routeId);
      const visibleBookedSeats =
        visibleBookingsByTripId.get(currentTrip.id) ?? 0;
      if (visibleBookedSeats === 0) return [];
      const earnings = visibleFareTotalsByTripId.get(currentTrip.id) ?? 0;
      return {
        id: currentTrip.id,
        date: currentTrip.date,
        bookedSeats: visibleBookedSeats,
        capacity: currentTrip.capacity,
        status: currentTrip.status,
        route: {
          id: routeData?.id || "",
          pickup_location_title: routeData?.pickup_location_title || "",
          pickup_location_locality: routeData?.pickup_location_locality || "",
          dropoff_location_title: routeData?.dropoff_location_title || "",
          dropoff_location_locality: routeData?.dropoff_location_locality || "",
          price: routeData?.price || 0,
          departure_time: routeData?.departure_time || currentTrip.date,
          arrival_time: routeData?.arrival_time || currentTrip.date,
        },
        earnings,
      };
    });

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

  async getTripBookings(user: JWTPayload, tripId: string) {
    const driverId = await this.resolveDriverId(user);
    const tripData = await db.query.trip.findFirst({
      where: eq(trip.id, tripId),
    });
    if (!tripData || tripData.driverId !== driverId) {
      throw createServiceError("Trip not found", 404);
    }

    const bookings = await db.query.booking.findMany({
      where: and(
        eq(booking.tripId, tripId),
        eq(booking.status, "confirmed"),
        notInArray(booking.paymentStatus, HIDDEN_BOOKING_PAYMENT_STATUSES),
      ),
    });
    const passengerMap = await this.getPassengersByUserIds(
      bookings.map((record) => record.userId),
    );

    return bookings.map((bookingRecord) => ({
      id: bookingRecord.id,
      seatNumber: bookingRecord.seatNumber ?? 0,
      status: bookingRecord.status,
      paymentStatus: bookingRecord.paymentStatus,
      createdAt: bookingRecord.createdAt,
      user: passengerMap.get(bookingRecord.userId) ?? null,
    }));
  }

  private async createBookingResult(userId: string, input: CreateBookingInput) {
    const passengerRecord = await this.getPassengerByUserId(userId);
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

      let tripRecord = await tx.query.trip.findFirst({
        where: and(
          eq(trip.routeId, input.routeId),
          gte(trip.date, start),
          lt(trip.date, end),
        ),
      });

      if (!tripRecord) {
        const [createdTrip] = await tx
          .insert(trip)
          .values({
            routeId: routeRecord.id,
            driverId: routeRecord.driverId,
            date: start,
            capacity: routeRecord.availableSeats,
            bookedSeats: 0,
            status: "pending",
          })
          .onConflictDoNothing({ target: [trip.routeId, trip.date] })
          .returning();
        tripRecord =
          createdTrip ??
          (await tx.query.trip.findFirst({
            where: and(
              eq(trip.routeId, input.routeId),
              gte(trip.date, start),
              lt(trip.date, end),
            ),
          }));
      }

      if (!tripRecord) throw createServiceError("Trip not found", 404);
      if (!BOOKABLE_TRIP_STATUSES.has(tripRecord.status)) {
        throw createServiceError("Trip is not open for booking", 400);
      }

      const existingBooking = await tx.query.booking.findFirst({
        where: and(
          eq(booking.tripId, tripRecord.id),
          eq(booking.userId, userId),
          inArray(booking.status, ["pending", "confirmed"]),
          notInArray(booking.paymentStatus, HIDDEN_BOOKING_PAYMENT_STATUSES),
        ),
        orderBy: [desc(booking.createdAt)],
      });

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
        await paymentService.upsertBookingHoldInTransaction(tx, {
          bookingId: existingBooking.id,
          tripId: existingBooking.tripId,
          userId: existingBooking.userId,
          expiresAt:
            existingBooking.expiresAt?.toISOString() ?? expiresAt.toISOString(),
        });
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
        [newBooking] = await tx
          .insert(booking)
          .values({
            tripId: tripRecord.id,
            userId,
            seatNumber: allocatedSeat.seatNumber,
            lastName: passengerRecord.lastName,
            fareAmount: routeRecord.price,
            currency: "NGN",
            status: "pending",
            expiresAt,
          })
          .returning();
      } catch (error) {
        if (isConstraintError(error, ACTIVE_BOOKING_CONSTRAINT)) {
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

      await paymentService.upsertBookingHoldInTransaction(tx, {
        bookingId: newBooking.id,
        tripId: newBooking.tripId,
        userId: newBooking.userId,
        expiresAt:
          newBooking.expiresAt?.toISOString() ?? expiresAt.toISOString(),
      });

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

  async createBooking(userId: string, input: CreateBookingInput) {
    const result = await this.createBookingResult(userId, input);
    return result.booking;
  }

  async createCheckoutBooking(userId: string, input: CreateBookingInput) {
    const result = await this.createBookingResult(userId, input);
    return {
      booking: result.booking,
      fareAmount: result.fareAmount,
      currency: result.currency,
      expiresAt: result.booking.expiresAt,
    };
  }
}
