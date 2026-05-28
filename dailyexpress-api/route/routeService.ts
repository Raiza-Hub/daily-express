import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  inArray,
  lt,
  ne,
  notInArray,
  or,
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
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;

type VehicleType = (typeof ALLOWED_VEHICLE_TYPES)[number];
type RouteRecord = typeof route.$inferSelect;
type BookingRecord = typeof booking.$inferSelect;
type TripRecord = typeof trip.$inferSelect;
type RouteTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type CreateBookingInput = {
  routeId: string;
  tripDate: string;
};
type RouteSearchCursor = {
  combinedScore: number;
  pickupScore: number;
  dropoffScore: number;
  createdAt: string;
  id: string;
};
type UserBookingsCursor = {
  createdAt: string;
  id: string;
};

const driverService = new DriverService();
const paymentService = new PaymentService();
const payoutService = new PayoutService();

function clampPageLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return DEFAULT_PAGE_LIMIT;
  }

  return Math.max(1, Math.min(MAX_PAGE_LIMIT, Math.floor(limit)));
}

function encodeCursor(value: RouteSearchCursor | UserBookingsCursor): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor<T extends object>(
  cursor: string | undefined,
  isValid: (value: unknown) => value is T,
): T | null {
  if (!cursor) {
    return null;
  }

  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (value && typeof value === "object" && isValid(value)) {
      return value;
    }
  } catch {
    // Fall through to the shared INVALID_CURSOR error below.
  }

  throw createServiceError("Invalid cursor", 400, "INVALID_CURSOR");
}

function isRouteSearchCursor(value: unknown): value is RouteSearchCursor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const cursor = value as Record<string, unknown>;

  return (
    typeof cursor.combinedScore === "number" &&
    typeof cursor.pickupScore === "number" &&
    typeof cursor.dropoffScore === "number" &&
    typeof cursor.createdAt === "string" &&
    !Number.isNaN(new Date(cursor.createdAt).getTime()) &&
    typeof cursor.id === "string"
  );
}

function isUserBookingsCursor(value: unknown): value is UserBookingsCursor {
  if (!value || typeof value !== "object") {
    return false;
  }
  const cursor = value as Record<string, unknown>;

  return (
    typeof cursor.createdAt === "string" &&
    !Number.isNaN(new Date(cursor.createdAt).getTime()) &&
    typeof cursor.id === "string"
  );
}

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
    cursor?: string;
  }): Promise<{ routes: Route[]; nextCursor: string | null }> {
    const { from, to, date, vehicleType, cursor } = params;
    const limit = clampPageLimit(params.limit);
    const parsedFrom = from.trim();
    const parsedTo = to.trim();
    const normalizedFrom = parsedFrom ? normalizeSearchText(parsedFrom) : "";
    const normalizedTo = parsedTo ? normalizeSearchText(parsedTo) : "";
    const decodedCursor = decodeCursor(cursor, isRouteSearchCursor);
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
    if (decodedCursor) {
      const cursorCreatedAt = new Date(decodedCursor.createdAt);
      const cursorCondition = or(
        lt(combinedScore, decodedCursor.combinedScore),
        and(
          eq(combinedScore, decodedCursor.combinedScore),
          lt(pickupScore, decodedCursor.pickupScore),
        ),
        and(
          eq(combinedScore, decodedCursor.combinedScore),
          eq(pickupScore, decodedCursor.pickupScore),
          lt(dropoffScore, decodedCursor.dropoffScore),
        ),
        and(
          eq(combinedScore, decodedCursor.combinedScore),
          eq(pickupScore, decodedCursor.pickupScore),
          eq(dropoffScore, decodedCursor.dropoffScore),
          lt(route.createdAt, cursorCreatedAt),
        ),
        and(
          eq(combinedScore, decodedCursor.combinedScore),
          eq(pickupScore, decodedCursor.pickupScore),
          eq(dropoffScore, decodedCursor.dropoffScore),
          eq(route.createdAt, cursorCreatedAt),
          gt(route.id, decodedCursor.id),
        ),
      );

      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const tripBookedSeats = db
      .select({
        routeId: trip.routeId,
        bookedSeats: sql<number>`coalesce(sum(${trip.bookedSeats}), 0)::int`.as(
          "booked_seats",
        ),
      })
      .from(trip)
      .where(and(gte(trip.date, start), lt(trip.date, end)))
      .groupBy(trip.routeId)
      .as("trip_booked_seats");
    const remainingSeats = sql<number>`greatest(${route.availableSeats} - coalesce(${tripBookedSeats.bookedSeats}, 0), 0)`;

    const routesResult = await db
      .select({
        route: getTableColumns(route),
        driver: getTableColumns(driver),
        pickupScore,
        dropoffScore,
        combinedScore,
        remainingSeats,
      })
      .from(route)
      .innerJoin(driver, eq(driver.id, route.driverId))
      .leftJoin(tripBookedSeats, eq(tripBookedSeats.routeId, route.id))
      .where(
        and(
          ...conditions,
          gte(pickupScore, ROUTE_SEARCH_SCORE_THRESHOLD),
          gte(dropoffScore, ROUTE_SEARCH_SCORE_THRESHOLD),
          sql`${remainingSeats} > 0`,
        ),
      )
      .orderBy(
        desc(combinedScore),
        desc(pickupScore),
        desc(dropoffScore),
        desc(route.createdAt),
        asc(route.id),
      )
      .limit(limit + 1);

    if (routesResult.length === 0) {
      return { routes: [], nextCursor: null };
    }

    const visibleRoutes = routesResult.map((record) => ({
      route: {
        ...record.route,
        remainingSeats: record.remainingSeats,
        driver: mapDriverToRouteDriver(record.driver),
      },
      cursor: {
        combinedScore: record.combinedScore,
        pickupScore: record.pickupScore,
        dropoffScore: record.dropoffScore,
        createdAt: record.route.createdAt.toISOString(),
        id: record.route.id,
      },
    }));

    const pageRoutes = visibleRoutes.slice(0, limit);
    const nextVisibleRoute = visibleRoutes[limit];
    const lastRoute = pageRoutes[pageRoutes.length - 1];

    return {
      routes: pageRoutes.map((record) => record.route),
      nextCursor:
        nextVisibleRoute && lastRoute ? encodeCursor(lastRoute.cursor) : null,
    };
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

  async getUserBookings(userId: string, limit = 20, cursor?: string) {
    const parsedLimit = clampPageLimit(limit);
    const decodedCursor = decodeCursor(cursor, isUserBookingsCursor);
    const visibleBookingConditions = and(
      eq(booking.userId, userId),
      inArray(booking.status, [...VISIBLE_BOOKING_STATUSES]),
      notInArray(
        booking.paymentStatus,
        // Intentionally omit refund statuses so users see refunded bookings
        ["failed", "cancelled", "expired"],
      ),
    );
    const cursorCondition = decodedCursor
      ? or(
          lt(booking.createdAt, new Date(decodedCursor.createdAt)),
          and(
            eq(booking.createdAt, new Date(decodedCursor.createdAt)),
            lt(booking.id, decodedCursor.id),
          ),
        )
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
          .orderBy(desc(booking.createdAt), desc(booking.id))
          .limit(parsedLimit + 1),
    );
    const pageBookingRows = bookingRows.slice(0, parsedLimit);
    const nextBookingRow = bookingRows[parsedLimit];
    const lastBookingRow = pageBookingRows[pageBookingRows.length - 1];

    const bookings = pageBookingRows.map((row) => {
      return {
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
      };
    });

    return {
      bookings,
      nextCursor:
        nextBookingRow && lastBookingRow
          ? encodeCursor({
              createdAt: lastBookingRow.booking.createdAt.toISOString(),
              id: lastBookingRow.booking.id,
            })
          : null,
    };
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

    const tripsWithDetails = tripRows.map((row) => {
      return {
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
    const bookingRows = await db
      .select({
        tripId: trip.id,
        booking: getTableColumns(booking),
        user: getTableColumns(users),
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
      .where(and(eq(trip.id, tripId), eq(trip.driverId, driverId)));

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
              user: row.user ? mapPassenger(row.user) : null,
            },
          ]
        : [],
    );
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
