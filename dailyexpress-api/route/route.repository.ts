import { and, asc, desc, eq, gte, inArray, lt, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "../db/connection";
import {
  booking,
  driver,
  origin,
  destination,
  passenger,
  trip,
  users,
  type OriginRecord,
  type DestinationRecord,
  type TripRecord,
  type BookingRecord,
  type DriverRecord,
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
          inArray(trip.status, ["pending", "confirmed", "awaiting_driver"]),
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
    const [row] = await db
      .select({ booking })
      .from(booking)
      .innerJoin(users, eq(users.id, booking.userId))
      .where(
        and(
          eq(booking.userId, userId),
          eq(booking.paymentReference, paymentReference),
          sql`lower(${users.lastName}) = ${normalizedLastName}`,
          eq(booking.status, "confirmed"),
        ),
      )
      .limit(1);
    return row?.booking ?? null;
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

  async deletePassengersByBooking(
    tx: RouteTransaction,
    bookingId: string,
  ): Promise<void> {
    await tx.delete(passenger).where(eq(passenger.bookingId, bookingId));
  }
}