import { and, asc, desc, eq, gte, gt, inArray, isNotNull, isNull, lt, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db/connection";
import {
  booking,
  driver,
  earning,
  externalDriver,
  route,
  trip,
  users,
  type RouteRecord,
  type TripRecord,
  type BookingRecord,
  type DriverRecord,
  type ExternalDriverRecord,
} from "../db/index";
import type { DbTransaction } from "../db/connection";

type RouteTransaction = DbTransaction;
type ExternalDriverInsert = typeof externalDriver.$inferInsert;

type TripWithRoute = {
  trip: TripRecord;
  route: RouteRecord;
};

type TripWithRouteAndBookings = TripWithRoute & {
  confirmedBookingCount: number;
};

export class RouteRepository {
  async findRouteById(id: string): Promise<RouteRecord | null> {
    return (await db.query.route.findFirst({ where: eq(route.id, id) })) ?? null;
  }

  async findAllRoutes(): Promise<RouteRecord[]> {
    return db.query.route.findMany({
      orderBy: [desc(route.createdAt)],
    });
  }

  async findRouteConflict(input: {
    pickup_location_title: string;
    pickup_location_locality: string;
    pickup_location_label: string;
    dropoff_location_title: string;
    dropoff_location_locality: string;
    dropoff_location_label: string;
    departure_time: string;
    excludeRouteId?: string;
  }): Promise<RouteRecord | null> {
    const conditions = [
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

    return (await db.query.route.findFirst({ where: and(...conditions) })) ?? null;
  }

  async insertRoute(tx: RouteTransaction, values: typeof route.$inferInsert): Promise<RouteRecord> {
    const [record] = await tx.insert(route).values(values).returning();
    return record;
  }

  async updateRoute(
    tx: RouteTransaction,
    id: string,
    values: Partial<typeof route.$inferInsert>,
  ): Promise<RouteRecord> {
    const [record] = await tx
      .update(route)
      .set(values)
      .where(eq(route.id, id))
      .returning();
    return record;
  }

  async deleteRoute(tx: RouteTransaction, id: string): Promise<void> {
    await tx.delete(route).where(eq(route.id, id));
  }

  async findTripById(id: string): Promise<TripRecord | null> {
    return (await db.query.trip.findFirst({ where: eq(trip.id, id) })) ?? null;
  }

  async findTripByRouteId(routeId: string): Promise<TripRecord | null> {
    return (await db.query.trip.findFirst({ where: eq(trip.routeId, routeId) })) ?? null;
  }

  async findTripByRouteAndDate(
    routeId: string,
    start: Date,
    end: Date,
  ): Promise<TripRecord | null> {
    return (
      (await db.query.trip.findFirst({
        where: and(
          eq(trip.routeId, routeId),
          gte(trip.date, start),
          lt(trip.date, end),
        ),
      })) ?? null
    );
  }

  async insertTrip(
    tx: RouteTransaction,
    values: typeof trip.$inferInsert,
  ): Promise<TripRecord | null> {
    const [record] = await tx
      .insert(trip)
      .values(values)
      .returning();
    return record ?? null;
  }

  async lockTrip(tx: RouteTransaction, tripId: string): Promise<TripRecord | null> {
    const [locked] = await tx
      .select()
      .from(trip)
      .where(eq(trip.id, tripId))
      .for("update")
      .limit(1);
    return locked ?? null;
  }

  async updateTrip(
    tx: RouteTransaction,
    id: string,
    values: Partial<typeof trip.$inferInsert>,
  ): Promise<TripRecord | null> {
    const [record] = await tx
      .update(trip)
      .set(values)
      .where(eq(trip.id, id))
      .returning();
    return record ?? null;
  }

  async updateTripStandalone(
    id: string,
    values: Partial<typeof trip.$inferInsert>,
  ): Promise<TripRecord | null> {
    const [record] = await db
      .update(trip)
      .set(values)
      .where(eq(trip.id, id))
      .returning();
    return record ?? null;
  }

  async findTripWithRoute(tripId: string) {
    const [result] = await db
      .select({
        trip: trip,
        route: route,
      })
      .from(trip)
      .innerJoin(route, eq(route.id, trip.routeId))
      .where(eq(trip.id, tripId));
    return result ?? null;
  }

  async findBookingById(id: string): Promise<BookingRecord | null> {
    return (await db.query.booking.findFirst({ where: eq(booking.id, id) })) ?? null;
  }

  async findExistingActiveBooking(
    tx: RouteTransaction,
    tripId: string,
    userId: string,
  ) {
    return (
      (await tx.query.booking.findFirst({
        where: and(
          eq(booking.tripId, tripId),
          eq(booking.userId, userId),
          inArray(booking.status, ["pending", "confirmed"]),
          notInArray(
            booking.paymentStatus,
            ["failed", "cancelled", "expired"],
          ),
        ),
        orderBy: [desc(booking.createdAt)],
      })) ?? null
    );
  }

  async insertBooking(
    tx: RouteTransaction,
    values: typeof booking.$inferInsert,
  ): Promise<BookingRecord> {
    const [record] = await tx.insert(booking).values(values).returning();
    return record;
  }

  async findBookingByPaymentRef(
    userId: string,
    paymentReference: string,
    normalizedLastName: string,
  ): Promise<BookingRecord | null> {
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

  async updateBookingsByTrip(
    tx: RouteTransaction,
    tripId: string,
    values: Partial<typeof booking.$inferInsert>,
    extraConditions?: SQL[],
  ) {
    const conditions = [eq(booking.tripId, tripId)];
    if (extraConditions) conditions.push(...extraConditions);

    await tx.update(booking).set(values).where(and(...conditions));
  }

  async findDriverById(id: string): Promise<DriverRecord | null> {
    return (await db.query.driver.findFirst({ where: eq(driver.id, id) })) ?? null;
  }

  async findDriverByUserId(userId: string): Promise<DriverRecord | null> {
    return (await db.query.driver.findFirst({ where: eq(driver.userId, userId) })) ?? null;
  }

  async findUserById(userId: string) {
    return (
      (await db.query.users.findFirst({ where: eq(users.id, userId) })) ?? null
    );
  }

  async findUsersByIds(userIds: string[]) {
    if (userIds.length === 0) return [];
    return db.query.users.findMany({
      where: inArray(users.id, userIds),
    });
  }

  async findTripsWithRoute(
    conditions: SQL[],
  ): Promise<TripWithRoute[]> {
    return db
      .select({ trip, route })
      .from(trip)
      .innerJoin(route, eq(route.id, trip.routeId))
      .where(and(...conditions))
      .orderBy(asc(trip.date));
  }

  async findTripsWithRouteAndBookingCount(
    conditions: SQL[],
    limit = 20,
    cursor?: { date: Date; id: string } | null,
    search?: string,
  ): Promise<{ rows: TripWithRouteAndBookings[]; hasMore: boolean; nextCursor: { date: Date; id: string } | null }> {
    const departureFilter = sql`((${trip.date} + ${route.departure_time}) AT TIME ZONE 'UTC') > now()`;

    const allConditions = [...conditions, departureFilter];

    if (search) {
      const pattern = `%${search}%`;
      allConditions.push(
        sql`(
          ${route.pickup_location_title} ILIKE ${pattern}
          OR ${route.pickup_location_locality} ILIKE ${pattern}
          OR ${route.dropoff_location_title} ILIKE ${pattern}
          OR ${route.dropoff_location_locality} ILIKE ${pattern}
        )`,
      );
    }

    if (cursor) {
      const cursorCondition = or(
        gt(trip.date, cursor.date),
        and(eq(trip.date, cursor.date), gt(trip.id, cursor.id)),
      );
      if (cursorCondition) {
        allConditions.push(cursorCondition);
      }
    }

    const rows = await db
      .select({
        trip,
        route,
        confirmedBookingCount: sql<number>`
          count(*) filter (where ${booking.status} = 'confirmed')
        `.as("confirmed_booking_count"),
      })
      .from(trip)
      .innerJoin(route, eq(route.id, trip.routeId))
      .leftJoin(booking, eq(booking.tripId, trip.id))
      .where(and(...allConditions))
      .groupBy(trip.id, route.id)
      .orderBy(asc(trip.date))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor = hasMore && lastRow
      ? { date: lastRow.trip.date, id: lastRow.trip.id }
      : null;

    return {
      rows: pageRows.map((r) => ({
        trip: r.trip,
        route: r.route,
        confirmedBookingCount: Number(r.confirmedBookingCount),
      })),
      hasMore,
      nextCursor,
    };
  }

  async countAvailableTripsByDateRange(start: Date, end: Date) {
    return db
      .select({ date: trip.date })
      .from(trip)
      .innerJoin(route, eq(route.id, trip.routeId))
      .where(
        and(
          eq(trip.status, "awaiting_driver"),
          isNull(trip.driverId),
          gte(trip.date, start),
          lt(trip.date, end),
          sql`((${trip.date} + ${route.departure_time}) AT TIME ZONE 'UTC') > now()`,
        ),
      )
      .orderBy(asc(trip.date));
  }

  async assignDriverToTrip(
    tx: RouteTransaction,
    tripId: string,
    driverId: string,
    vehicleId?: string,
  ): Promise<TripRecord | null> {
    const [record] = await tx
      .update(trip)
      .set({
        driverId,
        vehicleId: vehicleId ?? null,
        driverClaimedAt: new Date(),
        status: "confirmed",
        updatedAt: new Date(),
      })
      .where(and(eq(trip.id, tripId), isNull(trip.driverId)))
      .returning();
    return record ?? null;
  }

  async insertExternalDriver(
    tx: RouteTransaction,
    data: ExternalDriverInsert,
  ): Promise<ExternalDriverRecord> {
    const [record] = await tx
      .insert(externalDriver)
      .values(data)
      .returning();
    return record;
  }

  async findExternalDriverByTripId(
    tripId: string,
  ): Promise<ExternalDriverRecord | null> {
    return (
      (await db.query.externalDriver.findFirst({
        where: eq(externalDriver.tripId, tripId),
      })) ?? null
    );
  }

  async findBookingsByTripId(
    tripId: string,
  ): Promise<BookingRecord[]> {
    return db.query.booking.findMany({
      where: eq(booking.tripId, tripId),
    });
  }

  async findEarningByBookingId(bookingId: string) {
    return db.query.earning.findFirst({
      where: eq(earning.bookingId, bookingId),
    });
  }

  async findExpiredPendingBookings(before: Date) {
    return db.query.booking.findMany({
      where: and(
        eq(booking.status, "pending"),
        eq(booking.paymentStatus, "initialized"),
        isNotNull(booking.expiresAt),
        lte(booking.expiresAt, before),
      ),
    });
  }

  findSuccessfulBookingsByTripId(tripId: string) {
    return db.query.booking.findMany({
      where: and(eq(booking.tripId, tripId), eq(booking.paymentStatus, "successful")),
    });
  }

  async findVehicleScheduledAtDeparture(
    tx: RouteTransaction | typeof db,
    driverId: string,
    vehicleId: string,
    tripDate: Date,
    departureTime: string,
    excludeTripId?: string,
  ): Promise<TripRecord | null> {
    const conditions = [
      eq(trip.driverId, driverId),
      eq(trip.vehicleId, vehicleId),
      eq(trip.date, tripDate),
      eq(route.departure_time, departureTime),
      ne(trip.status, "completed"),
      ne(trip.status, "cancelled"),
    ];
    if (excludeTripId) {
      conditions.push(ne(trip.id, excludeTripId));
    }
    const [result] = await tx
      .select({ trip })
      .from(trip)
      .innerJoin(route, eq(route.id, trip.routeId))
      .where(and(...conditions))
      .limit(1);
    return result?.trip ?? null;
  }
}

export const routeRepository = new RouteRepository();
