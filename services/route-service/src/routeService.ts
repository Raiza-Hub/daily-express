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
  or,
  sql,
} from "drizzle-orm";
import {
  booking,
  consumedEvent,
  driverIdentity,
  passengerIdentity,
  route,
  trip,
} from "db/schema";
import { db } from "../db/db";
import type {
  Booking,
  CreateRoute,
  JWTPayload,
  Route,
  Trip,
  updateRouteRequest,
} from "@shared/types";
import { logger, reportError } from "@shared/logger";
import { createServiceError } from "@shared/utils";
import type {
  DriverIdentityCreatedEvent,
  DriverIdentityDeletedEvent,
  DriverIdentityUpdatedEvent,
  UserAccountDeletedEvent,
  UserIdentityUpsertedEvent,
} from "@shared/kafka";
import {
  emitBookingCancelled,
  emitBookingConfirmed,
  emitBookingCreated,
  emitRouteCreated,
  emitRouteDeleted,
  emitTripCancelled,
  emitTripCompleted,
  sendBookingNotification,
} from "./kafka/producer";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

const ALLOWED_VEHICLE_TYPES = ["car", "bus", "luxury_car"] as const;
const ROUTE_DUPLICATE_CONSTRAINT =
  "route_driver_origin_destination_departure_unique_idx";
const ACTIVE_BOOKING_CONSTRAINT = "booking_trip_id_user_id_active_idx";
const ROUTE_SEARCH_SCORE_THRESHOLD = 0.15;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ROUTE_SERVICE_TIMEZONE =
  process.env.ROUTE_SERVICE_TIMEZONE || "Africa/Lagos";
const BOOKABLE_TRIP_STATUSES = new Set(["pending", "confirmed"]);
const VISIBLE_BOOKING_STATUSES = ["confirmed", "completed"] as const;
const HIDDEN_BOOKING_PAYMENT_STATUSES = ["failed", "cancelled", "expired"];

type VehicleType = (typeof ALLOWED_VEHICLE_TYPES)[number];
type RouteRecord = typeof route.$inferSelect;
type TripRecord = typeof trip.$inferSelect;
type DriverIdentityRecord = typeof driverIdentity.$inferSelect;
type PassengerIdentityRecord = typeof passengerIdentity.$inferSelect;
type RouteDriverView = Route["driver"];
type DriverIdentityProjectionEvent =
  | DriverIdentityCreatedEvent
  | DriverIdentityUpdatedEvent;
type UserIdentityProjectionEvent = UserIdentityUpsertedEvent;
type CreateBookingInput = {
  routeId: string;
  tripDate: string;
};

type BookingRecord = typeof booking.$inferSelect;

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isVisibleBooking(record: BookingRecord): boolean {
  return (
    VISIBLE_BOOKING_STATUSES.includes(
      record.status as (typeof VISIBLE_BOOKING_STATUSES)[number],
    ) && !HIDDEN_BOOKING_PAYMENT_STATUSES.includes(record.paymentStatus)
  );
}

function createNormalizedSearchScore(
  column: any,
  rawQuery: string,
  normalizedQuery: string,
) {
  const normalizedColumn = sql`lower(regexp_replace(${column}, '\s+', ' ', 'g'))`;
  const containsNormalizedQuery = `%${normalizedQuery}%`;

  return sql<number>`greatest(
    similarity(${column}, ${rawQuery}),
    similarity(${normalizedColumn}, ${normalizedQuery}),
    CASE
      WHEN ${normalizedColumn} LIKE ${containsNormalizedQuery} THEN 1
      ELSE 0
    END
  )`;
}

function isRouteDuplicateConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const dbError = error as {
    code?: string;
    constraint?: string;
    constraint_name?: string;
    message?: string;
  };

  return (
    dbError.code === "23505" &&
    (dbError.constraint === ROUTE_DUPLICATE_CONSTRAINT ||
      dbError.constraint_name === ROUTE_DUPLICATE_CONSTRAINT ||
      dbError.message?.includes(ROUTE_DUPLICATE_CONSTRAINT) === true)
  );
}

function isActiveBookingConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const dbError = error as {
    code?: string;
    constraint?: string;
    constraint_name?: string;
    message?: string;
  };

  return (
    dbError.code === "23505" &&
    (dbError.constraint === ACTIVE_BOOKING_CONSTRAINT ||
      dbError.constraint_name === ACTIVE_BOOKING_CONSTRAINT ||
      dbError.message?.includes(ACTIVE_BOOKING_CONSTRAINT) === true)
  );
}

function parseDateKey(value: string): string {
  const trimmed = value.trim();
  if (!DATE_ONLY_REGEX.test(trimmed)) {
    throw createServiceError("Date must be in YYYY-MM-DD format", 400);
  }
  return trimmed;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = date.getUTCFullYear();
  const nextMonth = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const nextDay = `${date.getUTCDate()}`.padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function getDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const parts = getDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
): Date {
  const utcGuess = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond),
  );
  const offset = getTimeZoneOffsetMilliseconds(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

function getBusinessDayWindow(dateInput: string) {
  const dateKey = parseDateKey(dateInput);
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = zonedDateTimeToUtc(
    year,
    month,
    day,
    0,
    0,
    0,
    0,
    ROUTE_SERVICE_TIMEZONE,
  );
  const nextDateKey = addDaysToDateKey(dateKey, 1);
  const [nextYear, nextMonth, nextDay] = nextDateKey.split("-").map(Number);
  const end = zonedDateTimeToUtc(
    nextYear,
    nextMonth,
    nextDay,
    0,
    0,
    0,
    0,
    ROUTE_SERVICE_TIMEZONE,
  );

  return {
    dateKey,
    start,
    end,
  };
}

function getScheduledDepartureTime(tripDate: string, departureTime: Date) {
  const dateKey = parseDateKey(tripDate);
  const [year, month, day] = dateKey.split("-").map(Number);
  const timeParts = getDateTimeParts(departureTime, ROUTE_SERVICE_TIMEZONE);

  return zonedDateTimeToUtc(
    year,
    month,
    day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
    departureTime.getMilliseconds(),
    ROUTE_SERVICE_TIMEZONE,
  );
}

function formatBusinessDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ROUTE_SERVICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function formatBusinessDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: ROUTE_SERVICE_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatLocalTime(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: ROUTE_SERVICE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function mapDriverProjectionToRouteDriver(
  identityRecord: DriverIdentityRecord,
): RouteDriverView {
  return {
    id: identityRecord.driverId,
    firstName: identityRecord.firstName,
    lastName: identityRecord.lastName,
    phone: identityRecord.phone,
    profile_pic: identityRecord.profilePictureUrl ?? null,
    country: identityRecord.country,
    state: identityRecord.state,
  };
}

function mapPassengerProjection(identityRecord: PassengerIdentityRecord) {
  return {
    id: identityRecord.userId,
    firstName: identityRecord.firstName,
    lastName: identityRecord.lastName,
    email: identityRecord.email,
    phone: null,
  };
}

function toFareAmountMinor(price: number): number {
  return Math.round(price * 100);
}

export class RouteService {
  private async upsertPassengerIdentityProjection(
    event: UserIdentityProjectionEvent,
    topic: string,
  ) {
    const eventOccurredAt = new Date(event.occurredAt);

    await db.transaction(async (tx) => {
      const processed = await tx.query.consumedEvent.findFirst({
        where: eq(consumedEvent.eventId, event.eventId),
      });

      if (processed) {
        return;
      }

      const existing = await tx.query.passengerIdentity.findFirst({
        where: eq(passengerIdentity.userId, event.payload.userId),
      });

      const isStale =
        existing &&
        existing.sourceOccurredAt.getTime() > eventOccurredAt.getTime();

      if (!isStale) {
        if (!existing) {
          await tx.insert(passengerIdentity).values({
            userId: event.payload.userId,
            firstName: event.payload.firstName,
            lastName: event.payload.lastName,
            email: event.payload.email,
            sourceOccurredAt: eventOccurredAt,
            updatedAt: new Date(),
          });
        } else {
          await tx
            .update(passengerIdentity)
            .set({
              firstName: event.payload.firstName,
              lastName: event.payload.lastName,
              email: event.payload.email,
              sourceOccurredAt: eventOccurredAt,
              updatedAt: new Date(),
            })
            .where(eq(passengerIdentity.userId, event.payload.userId));
        }
      }

      await tx.insert(consumedEvent).values({
        eventId: event.eventId,
        topic,
      });
    });
  }

  private async upsertDriverIdentityProjection(
    event: DriverIdentityProjectionEvent,
    topic: string,
  ) {
    const eventOccurredAt = new Date(event.occurredAt);

    await db.transaction(async (tx) => {
      const processed = await tx.query.consumedEvent.findFirst({
        where: eq(consumedEvent.eventId, event.eventId),
      });

      if (processed) {
        return;
      }

      const existing = await tx.query.driverIdentity.findFirst({
        where: or(
          eq(driverIdentity.driverId, event.payload.driverId),
          eq(driverIdentity.userId, event.payload.userId),
        ),
      });

      const isStale =
        existing &&
        existing.sourceOccurredAt.getTime() > eventOccurredAt.getTime();

      if (!isStale) {
        if (!existing) {
          await tx.insert(driverIdentity).values({
            driverId: event.payload.driverId,
            userId: event.payload.userId,
            firstName: event.payload.firstName,
            lastName: event.payload.lastName,
            phone: event.payload.phone,
            profilePictureUrl: event.payload.profilePictureUrl ?? null,
            country: event.payload.country,
            state: event.payload.state,
            isActive: event.payload.isActive,
            sourceOccurredAt: eventOccurredAt,
            updatedAt: new Date(),
          });
        } else if (
          existing.driverId === event.payload.driverId &&
          existing.userId === event.payload.userId
        ) {
          await tx
            .update(driverIdentity)
            .set({
              firstName: event.payload.firstName,
              lastName: event.payload.lastName,
              phone: event.payload.phone,
              profilePictureUrl: event.payload.profilePictureUrl ?? null,
              country: event.payload.country,
              state: event.payload.state,
              isActive: event.payload.isActive,
              sourceOccurredAt: eventOccurredAt,
              updatedAt: new Date(),
            })
            .where(eq(driverIdentity.driverId, existing.driverId));
        } else {
          await tx
            .delete(driverIdentity)
            .where(
              or(
                eq(driverIdentity.driverId, existing.driverId),
                eq(driverIdentity.userId, existing.userId),
              ),
            );

          await tx.insert(driverIdentity).values({
            driverId: event.payload.driverId,
            userId: event.payload.userId,
            firstName: event.payload.firstName,
            lastName: event.payload.lastName,
            phone: event.payload.phone,
            profilePictureUrl: event.payload.profilePictureUrl ?? null,
            country: event.payload.country,
            state: event.payload.state,
            isActive: event.payload.isActive,
            sourceOccurredAt: eventOccurredAt,
            updatedAt: new Date(),
          });
        }
      }

      await tx.insert(consumedEvent).values({
        eventId: event.eventId,
        topic,
      });
    });
  }

  async handleDriverIdentityCreated(
    event: DriverIdentityCreatedEvent,
    topic: string,
  ) {
    await this.upsertDriverIdentityProjection(event, topic);
  }

  async handleDriverIdentityUpdated(
    event: DriverIdentityUpdatedEvent,
    topic: string,
  ) {
    await this.upsertDriverIdentityProjection(event, topic);
  }

  async handleDriverIdentityDeleted(
    event: DriverIdentityDeletedEvent,
    topic: string,
  ) {
    const eventOccurredAt = new Date(event.occurredAt);

    await db.transaction(async (tx) => {
      const processed = await tx.query.consumedEvent.findFirst({
        where: eq(consumedEvent.eventId, event.eventId),
      });

      if (processed) {
        return;
      }

      const existing = await tx.query.driverIdentity.findFirst({
        where: or(
          eq(driverIdentity.driverId, event.payload.driverId),
          eq(driverIdentity.userId, event.payload.userId),
        ),
      });

      if (
        existing &&
        existing.sourceOccurredAt.getTime() <= eventOccurredAt.getTime()
      ) {
        await tx
          .delete(driverIdentity)
          .where(
            or(
              eq(driverIdentity.driverId, existing.driverId),
              eq(driverIdentity.userId, existing.userId),
            ),
          );
      }

      await tx.insert(consumedEvent).values({
        eventId: event.eventId,
        topic,
      });
    });
  }

  async handleUserIdentityUpserted(
    event: UserIdentityUpsertedEvent,
    topic: string,
  ) {
    await this.upsertPassengerIdentityProjection(event, topic);
  }

  async handleUserAccountDeleted(
    event: UserAccountDeletedEvent,
    topic: string,
  ) {
    await db.transaction(async (tx) => {
      const processed = await tx.query.consumedEvent.findFirst({
        where: eq(consumedEvent.eventId, event.eventId),
      });

      if (processed) {
        return;
      }

      await tx
        .delete(passengerIdentity)
        .where(eq(passengerIdentity.userId, event.payload.userId));
      await tx
        .delete(driverIdentity)
        .where(eq(driverIdentity.userId, event.payload.userId));

      await tx.insert(consumedEvent).values({
        eventId: event.eventId,
        topic,
      });
    });
  }

  private async getPassengerIdentityByUserId(
    userId: string,
  ): Promise<PassengerIdentityRecord | null> {
    return (
      (await db.query.passengerIdentity.findFirst({
        where: eq(passengerIdentity.userId, userId),
      })) ?? null
    );
  }

  private async getPassengerIdentitiesByUserIds(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, ReturnType<typeof mapPassengerProjection>>();
    }

    const passengerRecords = await db.query.passengerIdentity.findMany({
      where: inArray(passengerIdentity.userId, userIds),
    });

    return new Map(
      passengerRecords.map((record) => [
        record.userId,
        mapPassengerProjection(record),
      ]),
    );
  }

  private async getPassengerDisplayName(
    userId: string,
  ): Promise<string | null> {
    const passengerRecord = await this.getPassengerIdentityByUserId(userId);
    if (!passengerRecord) {
      return null;
    }

    const fullName =
      `${passengerRecord.firstName} ${passengerRecord.lastName}`.trim();
    return fullName || null;
  }

  private async getDriverIdentityByDriverId(
    driverId: string,
  ): Promise<DriverIdentityRecord | null> {
    return (
      (await db.query.driverIdentity.findFirst({
        where: eq(driverIdentity.driverId, driverId),
      })) ?? null
    );
  }

  private async getDriverViewsByDriverIds(driverIds: string[]) {
    if (driverIds.length === 0) {
      return new Map<string, RouteDriverView>();
    }

    const driverRecords = await db.query.driverIdentity.findMany({
      where: inArray(driverIdentity.driverId, driverIds),
    });

    return new Map(
      driverRecords.map((record) => [
        record.driverId,
        mapDriverProjectionToRouteDriver(record),
      ]),
    );
  }

  private async resolveDriverIdentity(user: JWTPayload) {
    const identityRecord = await db.query.driverIdentity.findFirst({
      where: eq(driverIdentity.userId, user.userId),
    });

    if (!identityRecord) {
      throw createServiceError("Driver not found", 404);
    }

    return identityRecord;
  }

  private async resolveDriverId(user: JWTPayload): Promise<string> {
    const identityRecord = await this.resolveDriverIdentity(user);
    return identityRecord.driverId;
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
    driverRecord?: DriverIdentityRecord | null,
  ): Promise<Route> {
    const routeDriverRecord =
      driverRecord ?? (await this.getDriverIdentityByDriverId(record.driverId));

    if (!routeDriverRecord) {
      throw createServiceError("Driver not found", 404);
    }

    return {
      ...record,
      remainingSeats,
      driver: mapDriverProjectionToRouteDriver(routeDriverRecord),
    };
  }

  private async getBookingEventDetails(bookingId: string) {
    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
    });

    if (!bookingRecord) {
      throw createServiceError("Booking not found", 404);
    }

    const tripRecord = await db.query.trip.findFirst({
      where: eq(trip.id, bookingRecord.tripId),
    });

    if (!tripRecord) {
      throw createServiceError("Trip not found", 404);
    }

    const routeRecord = await db.query.route.findFirst({
      where: eq(route.id, tripRecord.routeId),
    });

    if (!routeRecord) {
      throw createServiceError("Route not found", 404);
    }

    return {
      bookingRecord,
      tripRecord,
      routeRecord,
    };
  }

  async createRoute(user: JWTPayload, routeData: CreateRoute): Promise<Route> {
    const driverRecord = await this.resolveDriverIdentity(user);

    const existingRoute = await this.findRouteConflict({
      driverId: driverRecord.driverId,
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
      [newRoute] = await db
        .insert(route)
        .values({ ...routeData, driverId: driverRecord.driverId })
        .returning();
    } catch (error) {
      if (isRouteDuplicateConstraintError(error)) {
        throw createServiceError("Route already exists", 400);
      }

      throw error;
    }

    await emitRouteCreated({
      routeId: newRoute.id,
      driverId: newRoute.driverId,
      origin: newRoute.pickup_location_title,
      destination: newRoute.dropoff_location_title,
      departureTime: newRoute.departure_time,
    });

    return this.buildRouteResponse(
      newRoute,
      newRoute.availableSeats,
      driverRecord,
    );
  }

  async getAllDriverRoutes(user: JWTPayload): Promise<Route[]> {
    const driverRecord = await this.resolveDriverIdentity(user);
    const routes = await db.query.route.findMany({
      where: eq(route.driverId, driverRecord.driverId),
      orderBy: [desc(route.createdAt)],
    });

    return routes.map((record) => ({
      ...record,
      remainingSeats: record.availableSeats,
      driver: mapDriverProjectionToRouteDriver(driverRecord),
    }));
  }

  async searchRoutes(params: {
    from?: string;
    to?: string;
    date?: string;
    vehicleType?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Route[]> {
    const { from, to, date, vehicleType, limit = 20, offset = 0 } = params;
    const parsedFrom = from?.trim();
    const parsedTo = to?.trim();
    const normalizedFrom = parsedFrom ? normalizeSearchText(parsedFrom) : "";
    const normalizedTo = parsedTo ? normalizeSearchText(parsedTo) : "";
    const parsedVehicleType = vehicleType?.filter(
      (value): value is VehicleType =>
        ALLOWED_VEHICLE_TYPES.includes(value as VehicleType),
    );

    if (!parsedFrom || !parsedTo) {
      throw createServiceError("from and to are required", 400);
    }

    if (!date) {
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
          sql`${pickupScore} >= ${ROUTE_SEARCH_SCORE_THRESHOLD}`,
          sql`${dropoffScore} >= ${ROUTE_SEARCH_SCORE_THRESHOLD}`,
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
        if (!routeDriver) {
          return null;
        }

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

        if (remainingSeats === 0) {
          return null;
        }

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
        .set(routeData)
        .where(eq(route.id, routeId))
        .returning();
    } catch (error) {
      if (isRouteDuplicateConstraintError(error)) {
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

    await db.delete(route).where(eq(route.id, routeId));
    await emitRouteDeleted({
      routeId: existingRoute.id,
      driverId: existingRoute.driverId,
    });
  }

  async syncBookingPaymentStatus(input: {
    bookingId: string;
    paymentReference: string;
    paymentStatus:
      | "initialized"
      | "pending"
      | "successful"
      | "failed"
      | "cancelled"
      | "expired";
  }): Promise<Booking> {
    const bookingExists = await db.query.booking.findFirst({
      where: eq(booking.id, input.bookingId),
    });

    if (!bookingExists) {
      throw createServiceError("Booking not found", 404);
    }

    const nextBookingStatus =
      input.paymentStatus === "successful"
        ? "confirmed"
        : input.paymentStatus === "failed" ||
            input.paymentStatus === "cancelled" ||
            input.paymentStatus === "expired"
          ? "cancelled"
          : "pending";
    const isCancellingTransition =
      nextBookingStatus === "cancelled" && bookingExists.status !== "cancelled";

    const updatePayload: {
      status?: "completed" | "cancelled" | "pending" | "confirmed";
      paymentReference: string;
      paymentStatus: string;
      updatedAt: Date;
      seatNumber?: number | null;
    } = {
      paymentReference: input.paymentReference,
      paymentStatus: input.paymentStatus,
      updatedAt: new Date(),
    };

    if (
      !(
        (bookingExists.status === "confirmed" &&
          nextBookingStatus !== "confirmed") ||
        (bookingExists.status === "cancelled" &&
          nextBookingStatus === "pending")
      )
    ) {
      updatePayload.status = nextBookingStatus;
    }

    if (isCancellingTransition) {
      updatePayload.seatNumber = null;
    }

    let updatedBooking!: Booking;
    await db.transaction(async (tx) => {
      if (isCancellingTransition) {
        await tx
          .update(trip)
          .set({ bookedSeats: sql`GREATEST(${trip.bookedSeats} - 1, 0)` })
          .where(
            sql`${trip.id} = ${bookingExists.tripId} AND ${trip.bookedSeats} > 0`,
          );
      }

      const [bookingResult] = await tx
        .update(booking)
        .set(updatePayload)
        .where(eq(booking.id, input.bookingId))
        .returning();

      updatedBooking = bookingResult;
    });

    if (
      input.paymentStatus === "successful" &&
      nextBookingStatus === "confirmed" &&
      bookingExists.status !== "confirmed"
    ) {
      const { tripRecord, routeRecord } = await this.getBookingEventDetails(
        updatedBooking.id,
      );
      const passengerName = await this.getPassengerDisplayName(
        updatedBooking.userId,
      );

      await emitBookingConfirmed({
        bookingId: updatedBooking.id,
        tripId: tripRecord.id,
        routeId: routeRecord.id,
        driverId: tripRecord.driverId,
        userId: updatedBooking.userId,
        passengerName,
        pickupTitle: routeRecord.pickup_location_title,
        dropoffTitle: routeRecord.dropoff_location_title,
        seatNumber: updatedBooking.seatNumber ?? 0,
        fareAmountMinor: toFareAmountMinor(routeRecord.price),
        currency: "NGN",
        paymentReference: input.paymentReference,
        tripDate: tripRecord.date.toISOString(),
        departureTime: routeRecord.departure_time.toISOString(),
      });
    }

    if (isCancellingTransition) {
      const { tripRecord, routeRecord } = await this.getBookingEventDetails(
        updatedBooking.id,
      );

      await emitBookingCancelled({
        bookingId: updatedBooking.id,
        tripId: tripRecord.id,
        routeId: routeRecord.id,
        driverId: tripRecord.driverId,
        paymentReference: input.paymentReference,
      });
    }

    return updatedBooking;
  }

  async updateTripStatus(
    user: JWTPayload,
    tripId: string,
    status:
      | "completed"
      | "cancelled"
      | "pending"
      | "confirmed"
      | "booking_closed",
  ): Promise<Trip> {
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

    if (
      status === "booking_closed" &&
      tripExists.bookedSeats >= tripExists.capacity
    ) {
      throw createServiceError("Cannot stop booking - trip is full", 400);
    }

    const previousStatus = tripExists.status;

    const [updatedTrip] = await db
      .update(trip)
      .set({ status, updatedAt: new Date() })
      .where(eq(trip.id, tripId))
      .returning();

    if (status !== "booking_closed") {
      await db
        .update(booking)
        .set({ status, updatedAt: new Date() })
        .where(eq(booking.tripId, tripId))
        .returning();
    }

    if (previousStatus !== status && status === "completed") {
      const routeRecord = await db.query.route.findFirst({
        where: eq(route.id, updatedTrip.routeId),
      });

      if (!routeRecord) {
        throw createServiceError("Route not found", 404);
      }

      await emitTripCompleted({
        tripId: updatedTrip.id,
        driverId: updatedTrip.driverId,
        pickupTitle: routeRecord.pickup_location_title,
        dropoffTitle: routeRecord.dropoff_location_title,
        tripDate: updatedTrip.date.toISOString(),
      });
    }

    if (previousStatus !== status && status === "cancelled") {
      await emitTripCancelled({
        tripId: updatedTrip.id,
        driverId: updatedTrip.driverId,
      });
    }

    return updatedTrip;
  }

  async getUserBookings(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{
    bookings: Array<{
      id: string;
      seatNumber: number;
      status: string;
      paymentReference: string | null;
      paymentStatus: string;
      createdAt: Date;
      updatedAt: Date;
      tripId: string;
      trip: {
        id: string;
        date: Date;
        status: string;
        bookedSeats: number;
        capacity: number;
        availableSeats: number;
        route: {
          id: string;
          pickupLocationTitle: string;
          pickupLocationLocality: string;
          pickupLocationLabel: string;
          dropoffLocationTitle: string;
          dropoffLocationLocality: string;
          dropoffLocationLabel: string;
          price: number;
          vehicleType: string;
          meetingPoint: string;
          departureTime: Date;
          arrivalTime: Date;
          driver: {
            id: string;
            firstName: string;
            lastName: string;
            phoneNumber: string;
            profilePictureUrl: string | null;
            country: string;
            state: string;
          } | null;
        };
      } | null;
    }>;
    total: number;
  }> {
    const limitNum = Number(limit) || 20;
    const offsetNum = Number(offset) || 0;

    const visibleBookingConditions = and(
      eq(booking.userId, userId),
      inArray(booking.status, [...VISIBLE_BOOKING_STATUSES]),
      sql`${booking.paymentStatus} NOT IN ('failed', 'cancelled', 'expired')`,
    );

    const bookings = (
      await db.query.booking.findMany({
        where: visibleBookingConditions,
        limit: limitNum,
        offset: offsetNum,
        orderBy: [desc(booking.createdAt)],
      })
    ).filter(isVisibleBooking);

    const countResult = await db
      .select({ count: count() })
      .from(booking)
      .where(visibleBookingConditions);

    const total = Number(countResult[0]?.count ?? 0);
    const tripIds = [
      ...new Set(bookings.map((record) => record.tripId).filter(Boolean)),
    ];
    const tripRecords =
      tripIds.length > 0
        ? (
            await db.query.trip.findMany({
              where: inArray(trip.id, tripIds),
            })
          ).filter((tripRecord) => tripRecord.status !== "cancelled")
        : [];
    const tripsById = new Map(tripRecords.map((record) => [record.id, record]));

    const visibleBookings = bookings.filter((bookingRecord) =>
      tripsById.has(bookingRecord.tripId),
    );

    const routeIds = [...new Set(tripRecords.map((record) => record.routeId))];
    const routeRecords =
      routeIds.length > 0
        ? await db.query.route.findMany({
            where: inArray(route.id, routeIds),
          })
        : [];
    const routesById = new Map(
      routeRecords.map((record) => [record.id, record]),
    );

    const driverIds = [
      ...new Set(routeRecords.map((record) => record.driverId)),
    ];
    const driverMap = await this.getDriverViewsByDriverIds(driverIds);

    const enrichedBookings = visibleBookings.map((bookingRecord) => {
      const tripRecord = tripsById.get(bookingRecord.tripId);

      if (!tripRecord) {
        return {
          id: bookingRecord.id,
          seatNumber: bookingRecord.seatNumber ?? 0,
          status: bookingRecord.status,
          paymentReference: bookingRecord.paymentReference ?? null,
          paymentStatus: bookingRecord.paymentStatus,
          createdAt: bookingRecord.createdAt,
          updatedAt: bookingRecord.updatedAt,
          tripId: bookingRecord.tripId,
          trip: null,
        };
      }

      const routeRecord = routesById.get(tripRecord.routeId);
      const routeDriver = routeRecord
        ? (driverMap.get(routeRecord.driverId) ?? null)
        : null;

      return {
        id: bookingRecord.id,
        seatNumber: bookingRecord.seatNumber ?? 0,
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
                  pickupLocationLocality: routeRecord.pickup_location_locality,
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

    return { bookings: enrichedBookings, total };
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
  ): Promise<
    Array<{
      date: string;
      totalEarnings: number;
      totalTrips: number;
      totalPassengers: number;
      trips: Array<{
        id: string;
        date: Date;
        bookedSeats: number;
        capacity: number;
        status: string;
        route: {
          id: string;
          pickup_location_title: string;
          pickup_location_locality: string;
          dropoff_location_title: string;
          dropoff_location_locality: string;
          price: number;
          departure_time: Date;
          arrival_time: Date;
        };
        earnings: number;
      }>;
    }>
  > {
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

    const routeIds = [
      ...new Set(trips.map((currentTrip) => currentTrip.routeId)),
    ];
    const routeRecords =
      routeIds.length > 0
        ? await db.query.route.findMany({
            where: inArray(route.id, routeIds),
          })
        : [];
    const routesById = new Map(
      routeRecords.map((routeRecord) => [routeRecord.id, routeRecord]),
    );

    const tripIds = trips.map((currentTrip) => currentTrip.id);
    const bookingRecords =
      tripIds.length > 0
        ? (
            await db.query.booking.findMany({
              where: and(
                inArray(booking.tripId, tripIds),
                inArray(booking.status, [...VISIBLE_BOOKING_STATUSES]),
                sql`${booking.paymentStatus} NOT IN ('failed', 'cancelled', 'expired')`,
              ),
            })
          ).filter(isVisibleBooking)
        : [];
    const visibleBookingsByTripId = bookingRecords.reduce(
      (acc, bookingRecord) => {
        acc.set(bookingRecord.tripId, (acc.get(bookingRecord.tripId) ?? 0) + 1);
        return acc;
      },
      new Map<string, number>(),
    );

    const tripsWithDetails = trips.flatMap((currentTrip) => {
      const routeData = routesById.get(currentTrip.routeId);
      const visibleBookedSeats =
        visibleBookingsByTripId.get(currentTrip.id) ?? 0;

      if (visibleBookedSeats === 0) {
        return [];
      }

      const earnings = visibleBookedSeats * (routeData?.price || 0);

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

  async getTripBookings(
    user: JWTPayload,
    tripId: string,
  ): Promise<
    Array<{
      id: string;
      seatNumber: number;
      status: string;
      paymentStatus: string;
      createdAt: Date;
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone?: string | null;
      } | null;
    }>
  > {
    const driverId = await this.resolveDriverId(user);
    const tripData = await db.query.trip.findFirst({
      where: eq(trip.id, tripId),
    });

    if (!tripData || tripData.driverId !== driverId) {
      throw createServiceError("Trip not found", 404);
    }

    const bookings = await db.query.booking.findMany({
      where: and(eq(booking.tripId, tripId), eq(booking.status, "confirmed")),
    });

    const passengerMap = await this.getPassengerIdentitiesByUserIds(
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

  async sendBookingConfirmationEmail(
    bookingId: string,
    fallbackEmail?: string,
  ) {
    try {
      const bookingRecord = await db.query.booking.findFirst({
        where: eq(booking.id, bookingId),
      });

      if (!bookingRecord) {
        logger.warn("booking.confirmation_email_skipped", {
          reason: "booking_not_found",
          booking_id: bookingId,
        });
        return;
      }

      const tripData = await db.query.trip.findFirst({
        where: eq(trip.id, bookingRecord.tripId),
      });

      if (!tripData) {
        logger.warn("booking.confirmation_email_skipped", {
          reason: "trip_not_found",
          booking_id: bookingId,
        });
        return;
      }

      const routeData = await db.query.route.findFirst({
        where: eq(route.id, tripData.routeId),
      });

      if (!routeData) {
        logger.warn("booking.confirmation_email_skipped", {
          reason: "route_not_found",
          trip_id: tripData.id,
        });
        return;
      }

      const passengerRecord = await this.getPassengerIdentityByUserId(
        bookingRecord.userId,
      );
      const driverRecord = await this.getDriverIdentityByDriverId(
        routeData.driverId,
      );
      const recipientEmail = passengerRecord?.email || fallbackEmail;

      if (!recipientEmail) {
        logger.warn("booking.confirmation_email_skipped", {
          reason: "recipient_missing",
          booking_id: bookingId,
        });
        return;
      }

      const propsJson = JSON.stringify({
        frontendUrl: process.env.FRONTEND_URL,
        passengerName: passengerRecord
          ? `${passengerRecord.firstName} ${passengerRecord.lastName}`
          : null,
        paymentReference:
          bookingRecord.paymentReference || bookingId.slice(0, 8).toUpperCase(),
        pricePaid: formatPrice(routeData.price),
        pickupTitle: routeData.pickup_location_title,
        dropoffTitle: routeData.dropoff_location_title,
        tripDate: formatBusinessDateLabel(tripData.date),
        departureTime: formatLocalTime(routeData.departure_time),
        vehicleType: routeData.vehicleType,
        seatNumber: bookingRecord.seatNumber,
        meetingPoint: routeData.meeting_point,
        driverName: driverRecord
          ? `${driverRecord.firstName} ${driverRecord.lastName}`
          : null,
        driverPhone: driverRecord?.phone ?? null,
      });

      await sendBookingNotification({
        to: recipientEmail,
        subject: `Booking Confirmed - ${routeData.pickup_location_title} to ${routeData.dropoff_location_title}`,
        template: "BookingConfirmedEmail",
        propsJson,
      });
    } catch (emailError) {
      reportError(emailError, {
        source: "route-service",
        booking_id: bookingId,
        message: "Failed to send booking confirmation email",
      });
    }
  }

  private async createBookingResult(userId: string, input: CreateBookingInput) {
    const passengerRecord = await this.getPassengerIdentityByUserId(userId);
    if (!passengerRecord) {
      throw createServiceError("Passenger not found", 404);
    }

    const { start, end } = getBusinessDayWindow(input.tripDate);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const result = await db.transaction(async (tx) => {
      const routeRecord = await tx.query.route.findFirst({
        where: eq(route.id, input.routeId),
      });

      if (!routeRecord) {
        throw createServiceError("Route not found", 404);
      }

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
          .onConflictDoNothing({
            target: [trip.routeId, trip.date],
          })
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

      if (!tripRecord) {
        throw createServiceError("Trip not found", 404);
      }

      if (!BOOKABLE_TRIP_STATUSES.has(tripRecord.status)) {
        throw createServiceError("Trip is not open for booking", 400);
      }

      const existingBooking = await tx.query.booking.findFirst({
        where: and(
          eq(booking.tripId, tripRecord.id),
          eq(booking.userId, userId),
          inArray(booking.status, ["pending", "confirmed"]),
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

        if (!isExpired) {
          return {
            booking: existingBooking,
            fareAmount: routeRecord.price,
          };
        }
      }

      const updatedTrip = await tx
        .update(trip)
        .set({ bookedSeats: sql`booked_seats + 1` })
        .where(
          sql`${trip.id} = ${tripRecord.id} AND ${trip.bookedSeats} < ${trip.capacity} AND ${trip.status} IN ('pending', 'confirmed')`,
        )
        .returning({
          bookedSeats: trip.bookedSeats,
          capacity: trip.capacity,
          id: trip.id,
        });

      if (updatedTrip.length === 0) {
        if (tripRecord.bookedSeats >= tripRecord.capacity) {
          throw createServiceError("Trip is full", 400);
        }

        throw createServiceError("Trip is not open for booking", 400);
      }

      const seatNumber = updatedTrip[0].bookedSeats;

      let newBooking;
      try {
        [newBooking] = await tx
          .insert(booking)
          .values({
            tripId: tripRecord.id,
            userId,
            seatNumber,
            lastName: passengerRecord.lastName,
            status: "pending",
            expiresAt,
          })
          .returning();
      } catch (error) {
        if (!isActiveBookingConstraintError(error)) {
          throw error;
        }

        await tx
          .update(trip)
          .set({
            bookedSeats: sql`greatest(0, ${trip.bookedSeats} - 1)`,
            updatedAt: new Date(),
          })
          .where(eq(trip.id, tripRecord.id));

        const activeBooking = await tx.query.booking.findFirst({
          where: and(
            eq(booking.tripId, tripRecord.id),
            eq(booking.userId, userId),
            inArray(booking.status, ["pending", "confirmed"]),
          ),
          orderBy: [desc(booking.createdAt)],
        });

        if (!activeBooking) {
          throw error;
        }

        if (activeBooking.status === "confirmed") {
          throw createServiceError(
            "You already have a confirmed booking for this trip",
            409,
          );
        }

        return {
          booking: activeBooking,
          fareAmount: routeRecord.price,
        };
      }

      return {
        booking: newBooking,
        fareAmount: routeRecord.price,
      };
    });

    await emitBookingCreated({
      bookingId: result.booking.id,
      tripId: result.booking.tripId,
      userId: result.booking.userId,
      fareAmount: result.fareAmount,
      currency: "NGN",
      expiresAt:
        result.booking.expiresAt?.toISOString() ?? expiresAt.toISOString(),
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
      currency: "NGN",
      expiresAt: result.booking.expiresAt,
    };
  }
}
