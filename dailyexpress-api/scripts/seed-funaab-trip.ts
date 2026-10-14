import "dotenv/config";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/connection";
import { users } from "../db/auth-schema";
import { driver } from "../db/driver-schema";
import { destination, origin, trip } from "../db/route-schema";
import { earning } from "../db/payout-schema";
import { tripDispatchService } from "../dispatch/trip-dispatch.service";

const DEST_TITLE = "Professor Wole Soyinka Train Station";
const DEST_LOCALITY = "Abeokuta";
const ORIGIN_TITLE = "Federal University of Agriculture, Abeokuta";
const ORIGIN_LOCALITY = "Abeokuta";
const DRIVER_FIRST_NAME = "Abeokuta";
const DRIVER_LAST_NAME = "Driver";
const DRIVER_EMAIL = "abeokuta.driver+test@dailyexpress.app";
const DRIVER_PHONE = "+2347059062687";
const TRIP_DATE = "2026-10-15";
const DEPARTURE_TIME = "08:00:00";
const CAPACITY = 4;
const AMOUNT = 15000;

async function seedDestination() {
  const existing = await db
    .select()
    .from(destination)
    .where(
      and(
        eq(destination.title, DEST_TITLE),
        eq(destination.locality, DEST_LOCALITY),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const [row] = await db
    .insert(destination)
    .values({ title: DEST_TITLE, locality: DEST_LOCALITY, status: "active" })
    .returning();
  return row;
}

async function seedOrigin(destinationId: string) {
  const existing = await db
    .select()
    .from(origin)
    .where(and(eq(origin.title, ORIGIN_TITLE), eq(origin.locality, ORIGIN_LOCALITY)))
    .limit(1);
  if (existing[0]) return existing[0];

  const [row] = await db
    .insert(origin)
    .values({
      title: ORIGIN_TITLE,
      locality: ORIGIN_LOCALITY,
      meetingPoint: "FUNAAB Main Gate",
      departureTime: [DEPARTURE_TIME],
      price: AMOUNT,
      fee: 0,
      luggageFee: 0,
      destinationIds: [destinationId],
      status: "active",
    })
    .returning();
  return row;
}

async function seedUser() {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, DRIVER_EMAIL))
    .limit(1);
  if (existing[0]) return existing[0];

  const [row] = await db
    .insert(users)
    .values({
      firstName: DRIVER_FIRST_NAME,
      lastName: DRIVER_LAST_NAME,
      email: DRIVER_EMAIL,
      dateOfBirth: new Date("1990-01-01"),
      emailVerified: true,
      phone: DRIVER_PHONE,
    })
    .returning();
  return row;
}

async function seedDriver(userId: string) {
  const existing = await db
    .select()
    .from(driver)
    .where(eq(driver.email, DRIVER_EMAIL))
    .limit(1);
  if (existing[0]) return existing[0];

  const [row] = await db
    .insert(driver)
    .values({
      userId,
      firstName: DRIVER_FIRST_NAME,
      lastName: DRIVER_LAST_NAME,
      email: DRIVER_EMAIL,
      phone: DRIVER_PHONE,
      country: "Nigeria",
      currency: "NGN",
      state: "Ogun",
      city: ORIGIN_LOCALITY,
      address: "Abeokuta, Ogun State",
      kycStatus: "active",
      isActive: true,
    })
    .returning();
  return row;
}

async function seedTrip(originId: string, destinationId: string) {
  const existing = await db
    .select()
    .from(trip)
    .where(
      and(
        eq(trip.originId, originId),
        eq(trip.destinationId, destinationId),
        eq(trip.date, TRIP_DATE),
        eq(trip.departureTime, DEPARTURE_TIME),
        isNull(trip.driverId),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const [row] = await db
    .insert(trip)
    .values({
      originId,
      destinationId,
      driverId: null,
      date: TRIP_DATE,
      departureTime: DEPARTURE_TIME,
      capacity: CAPACITY,
      bookedSeats: CAPACITY,
      status: "awaiting_driver",
    })
    .returning();
  return row;
}

async function seedEarning(tripId: string) {
  await db
    .insert(earning)
    .values({ tripId, amount: AMOUNT, currency: "NGN" })
    .onConflictDoNothing({ target: earning.tripId });
  const [row] = await db
    .select()
    .from(earning)
    .where(eq(earning.tripId, tripId))
    .limit(1);
  return row;
}

const dest = await seedDestination();
const orig = await seedOrigin(dest.id);
const user = await seedUser();
const drv = await seedDriver(user.id);
const tripRow = await seedTrip(orig.id, dest.id);
const earn = await seedEarning(tripRow.id);

console.log("destination:", dest.id, dest.title);
console.log("origin:", orig.id, orig.title);
console.log("user:", user.id, user.email);
console.log("driver:", drv.id, drv.phone, "city=", drv.city);
console.log("trip:", tripRow.id, tripRow.date, tripRow.departureTime, tripRow.status);
console.log("earning:", earn?.id, earn?.amount, earn?.currency);

await db.transaction(async (tx) => {
  await tripDispatchService.trackTripAfterBooking(tx, tripRow.id);
});

const dispatch = await db.query.tripDispatch.findFirst({
  where: (d, { eq: eqOp }) => eqOp(d.tripId, tripRow.id),
});
console.log("dispatch:", dispatch?.id, dispatch?.status, dispatch?.deadlineAt);

process.exit(0);
