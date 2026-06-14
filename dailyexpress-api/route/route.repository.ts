import { and, desc, eq, gte, inArray, lt, ne, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, driver, route, trip, users } from "../db/index";

type RouteTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type RouteRecord = typeof route.$inferSelect;
type TripRecord = typeof trip.$inferSelect;
type BookingRecord = typeof booking.$inferSelect;
type DriverRecord = typeof driver.$inferSelect;

export class RouteRepository {
  async findRouteById(id: string): Promise<RouteRecord | null> {
    return (await db.query.route.findFirst({ where: eq(route.id, id) })) ?? null;
  }

  async findRoutesByDriverId(driverId: string): Promise<RouteRecord[]> {
    return db.query.route.findMany({
      where: eq(route.driverId, driverId),
      orderBy: [desc(route.createdAt)],
    });
  }

  async findRouteConflict(input: {
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
      .onConflictDoNothing({ target: [trip.routeId, trip.date] })
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
}
