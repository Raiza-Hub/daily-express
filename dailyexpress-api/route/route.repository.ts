import { and, desc, eq, gte, inArray, lt, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "../db/connection";
import {
  booking,
  driver,
  earning,
  route,
  trip,
  users,
  type RouteRecord,
  type TripRecord,
  type BookingRecord,
  type DriverRecord,
} from "../db/index";
import type { DbTransaction } from "../db/connection";

type RouteTransaction = DbTransaction;

type RouteWithAssociations = RouteRecord;

type TripWithRoute = {
  trip: TripRecord;
  route: RouteRecord;
};

export class RouteRepository {
  async findRouteById(id: string): Promise<RouteWithAssociations | null> {
    const result = await db.query.route.findFirst({
      where: eq(route.id, id),
    });
    return result ?? null;
  }

  async findAllRoutes(): Promise<RouteWithAssociations[]> {
    return db.query.route.findMany({
      orderBy: [desc(route.createdAt)],
    });
  }

  async findRouteConflict(input: {
    origin_title: string;
    origin_locality: string;
    origin_label: string;
  }): Promise<RouteRecord | undefined> {
    return db.query.route.findFirst({
      where: and(
        eq(route.origin_title, input.origin_title),
        eq(route.origin_locality, input.origin_locality),
        eq(route.origin_label, input.origin_label),
      ),
    });
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

  async findTripWithRoute(tripId: string): Promise<TripWithRoute | null> {
    const result = await db.query.trip.findFirst({
      where: eq(trip.id, tripId),
      with: {
        route: true,
      },
    });
    if (!result) return null;
    const { route: routeRecord, ...tripRecord } = result;
    return { trip: tripRecord as TripRecord, route: routeRecord as TripWithRoute["route"] };
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
}

export const routeRepository = new RouteRepository();
