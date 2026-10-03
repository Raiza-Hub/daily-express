import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "../db/connection";
import {
  booking,
  destination,
  driver,
  earning,
  origin,
  passenger,
  payment,
  payout,
  refund,
  trip,
  users,
  type OriginRecord,
  type DestinationRecord,
  type TripRecord,
  type BookingRecord,
  type PassengerRecord,
} from "../db/index";
import type { DbTransaction } from "../db/connection";

import {
  getRouteServiceTimeZone,
  scheduledAtSql,
} from "../utils/db-datetime";
import { addDaysToDateKey } from "../utils/route";

type RouteTransaction = DbTransaction;

type TripWithOriginDestination = {
  trip: TripRecord;
  origin: OriginRecord;
  destination: DestinationRecord;
  hasDeparted: boolean;
};

export class RouteRepository {
  async findOriginById(id: string, tx?: RouteTransaction): Promise<OriginRecord | null> {
    if (tx) {
      const result = await tx.query.origin.findFirst({
        where: eq(origin.id, id),
      });
      return result ?? null;
    }
    const result = await db.query.origin.findFirst({
      where: eq(origin.id, id),
    });
    return result ?? null;
  }

  async findDestinationById(id: string, tx?: RouteTransaction): Promise<DestinationRecord | null> {
    if (tx) {
      const result = await tx.query.destination.findFirst({
        where: eq(destination.id, id),
      });
      return result ?? null;
    }
    const result = await db.query.destination.findFirst({
      where: eq(destination.id, id),
    });
    return result ?? null;
  }

  async findActiveOrigins(): Promise<Array<OriginRecord & { destinations: DestinationRecord[] }>> {
    const origins = await db.query.origin.findMany({
      where: eq(origin.status, "active"),
      orderBy: [desc(origin.createdAt)],
    });

    if (origins.length === 0) {
      return [];
    }

    const destIds = origins.flatMap((o) => o.destinationIds).filter(Boolean) as string[];

    let destMap = new Map<string, DestinationRecord>();
    if (destIds.length > 0) {
      const dests = await db.query.destination.findMany({
        where: and(
          inArray(destination.id, destIds),
          eq(destination.status, "active"),
        ),
      });
      destMap = new Map(dests.map((d) => [d.id, d]));
    }

    return origins.map((o) => ({
      ...o,
      destinations: (o.destinationIds || []).map((id) => destMap.get(id)).filter(Boolean) as DestinationRecord[],
    }));
  }

  async findOriginConflict(input: {
    title: string;
    locality: string;
  }): Promise<OriginRecord | undefined> {
    return db.query.origin.findFirst({
      where: and(
        eq(origin.title, input.title),
        eq(origin.locality, input.locality),
      ),
    });
  }

  async findDestinationConflict(input: {
    title: string;
    locality: string;
  }): Promise<DestinationRecord | undefined> {
    return db.query.destination.findFirst({
      where: and(
        eq(destination.title, input.title),
        eq(destination.locality, input.locality),
      ),
    });
  }

  async insertOrigin(tx: RouteTransaction, values: typeof origin.$inferInsert): Promise<OriginRecord> {
    const [record] = await tx.insert(origin).values(values).returning();
    return record;
  }

  async updateOrigin(
    tx: RouteTransaction,
    id: string,
    values: Partial<typeof origin.$inferInsert>,
  ): Promise<OriginRecord> {
    const [record] = await tx
      .update(origin)
      .set(values)
      .where(eq(origin.id, id))
      .returning();
    return record;
  }

  async deactivateOrigin(tx: RouteTransaction, id: string): Promise<void> {
    await tx
      .update(origin)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(origin.id, id));
  }

  async insertDestination(tx: RouteTransaction, values: typeof destination.$inferInsert): Promise<DestinationRecord> {
    const [record] = await tx.insert(destination).values(values).returning();
    return record;
  }

  async updateDestination(
    tx: RouteTransaction,
    id: string,
    values: Partial<typeof destination.$inferInsert>,
  ): Promise<DestinationRecord> {
    const [record] = await tx
      .update(destination)
      .set(values)
      .where(eq(destination.id, id))
      .returning();
    return record;
  }

  async deactivateDestination(tx: RouteTransaction, id: string): Promise<void> {
    await tx
      .update(destination)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(destination.id, id));
  }

  async findTripsForSlot(
    tx: RouteTransaction,
    originId: string,
    destinationId: string,
    dateKey: string,
    departureTime: string,
  ): Promise<TripRecord[]> {
    return tx
      .select()
      .from(trip)
      .where(
        and(
          eq(trip.originId, originId),
          eq(trip.destinationId, destinationId),
          gte(trip.date, dateKey),
          lt(trip.date, addDaysToDateKey(dateKey, 1)),
          eq(trip.departureTime, departureTime),
          eq(trip.status, "awaiting_driver"),
        ),
      )
      .orderBy(
        asc(sql`${trip.capacity} - ${trip.bookedSeats}`),
        asc(trip.createdAt),
      )
      .for("update");
  }

  async createTrip(
    tx: RouteTransaction,
    values: typeof trip.$inferInsert,
  ): Promise<TripRecord> {
    const [record] = await tx
      .insert(trip)
      .values(values)
      .returning();
    return record;
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

  async findTripWithOriginDestination(tripId: string): Promise<TripWithOriginDestination | null> {
    const [result] = await db
      .select({
        trip: trip,
        origin: origin,
        destination: destination,
        hasDeparted: sql<boolean>`${scheduledAtSql(trip.date, trip.departureTime)} <= now()`,
      })
      .from(trip)
      .innerJoin(origin, eq(trip.originId, origin.id))
      .innerJoin(destination, eq(trip.destinationId, destination.id))
      .where(eq(trip.id, tripId))
      .limit(1);
    if (!result) return null;
    return {
      trip: result.trip as TripRecord,
      origin: result.origin as OriginRecord,
      destination: result.destination as DestinationRecord,
      hasDeparted: Boolean(result.hasDeparted),
    };
  }

  async hasTripSlotDeparted(
    tripDate: string,
    departureTime: string,
  ): Promise<boolean> {
    const rows = (await db.execute(
      sql`select ((${tripDate}::date + ${departureTime}::time) AT TIME ZONE ${getRouteServiceTimeZone()}) <= now() as "departed"`,
    )) as Array<{ departed: boolean }>;
    return Boolean(rows[0]?.departed);
  }

  async findBookingById(id: string): Promise<BookingRecord | null> {
    return (await db.query.booking.findFirst({ where: eq(booking.id, id) })) ?? null;
  }

  async insertBooking(
    tx: RouteTransaction,
    values: typeof booking.$inferInsert,
  ): Promise<BookingRecord> {
    const [record] = await tx.insert(booking).values(values).returning();
    return record;
  }

  async findUserById(userId: string) {
    return (
      (await db.query.users.findFirst({ where: eq(users.id, userId) })) ?? null
    );
  }

  async insertPassengers(
    tx: RouteTransaction,
    values: typeof passenger.$inferInsert[],
  ): Promise<void> {
    if (values.length === 0) return;
    await tx.insert(passenger).values(values);
  }

  async findPassengersByBooking(
    bookingId: string,
  ): Promise<PassengerRecord[]> {
    return db.query.passenger.findMany({
      where: eq(passenger.bookingId, bookingId),
    });
  }

  async hasConfirmedBookingOnTrip(
    userId: string,
    tripId: string,
  ): Promise<boolean> {
    const existing = await db.query.booking.findFirst({
      where: and(
        eq(booking.tripId, tripId),
        eq(booking.userId, userId),
        eq(booking.status, "confirmed"),
      ),
      columns: { id: true },
    });
    return Boolean(existing);
  }

  async findTripPassengersForTrip(tripId: string) {
    const tripBookings = await db.query.booking.findMany({
      where: and(eq(booking.tripId, tripId), eq(booking.status, "confirmed")),
      columns: { id: true },
    });
    const bookingIds = tripBookings.map((tripBooking) => tripBooking.id);
    if (bookingIds.length === 0) return [];
    return db.query.passenger.findMany({
      where: inArray(passenger.bookingId, bookingIds),
      columns: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        carriesLuggage: true,
      },
      orderBy: (fields, { asc }) => [asc(fields.createdAt)],
    });
  }

  async isDriverForTrip(userId: string, tripId: string): Promise<boolean> {
    const [existing] = await db
      .select({ id: trip.id })
      .from(trip)
      .innerJoin(driver, eq(trip.driverId, driver.id))
      .where(and(eq(trip.id, tripId), eq(driver.userId, userId)))
      .limit(1);
    return Boolean(existing);
  }

  async findDriverTrips(driverId: string, from: string, to: string) {
    return db
      .select({
        id: trip.id,
        origin: origin.title,
        destination: destination.title,
        date: trip.date,
        departureTime: trip.departureTime,
        price: sql<number>`COALESCE(${earning.amount}, 0)::float8`,
        tripStatus: trip.status,
        payoutStatus: payout.status,
      })
      .from(trip)
      .innerJoin(origin, eq(trip.originId, origin.id))
      .innerJoin(destination, eq(trip.destinationId, destination.id))
      .leftJoin(earning, eq(earning.tripId, trip.id))
      .leftJoin(payout, eq(payout.id, earning.payoutId))
      .where(
        and(
          eq(trip.driverId, driverId),
          gte(trip.date, from),
          lte(trip.date, to),
        ),
      )
      .orderBy(asc(trip.date), asc(trip.departureTime));
  }
}
