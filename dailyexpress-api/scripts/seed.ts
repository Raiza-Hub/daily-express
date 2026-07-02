import "dotenv/config";
import { db } from "../db/connection";
import { booking, driver, driverStats, earning, externalDriver, payment, refund, route, trip, users, vehicle } from "../db/index";
const ADEBOLA_USER_ID = "e6eacda7-8318-4724-8efe-641acf7f9c92";
const DRIVER_EMAIL = "emeka.okafor@example.com";

async function lookupRoute(pickup: string, dropoff: string) {
  const found = await db.query.route.findFirst({
    where: (r, { and, eq }) => and(
      eq(r.pickup_location_title, pickup),
      eq(r.dropoff_location_title, dropoff),
    ),
  });
  if (!found) throw new Error(`Route not found: ${pickup} → ${dropoff}`);
  return found.id;
}

async function findOrCreateOouOshodiRoute() {
  const existing = await db.query.route.findFirst({
    where: (r, { and, eq }) => and(
      eq(r.pickup_location_title, "OOU university"),
      eq(r.dropoff_location_title, "Oshodi"),
      eq(r.departure_time, "14:00:00"),
    ),
  });
  if (existing) return existing.id;

  const [record] = await db.insert(route).values({
    pickup_location_title: "OOU university",
    pickup_location_locality: "Ago-Iwoye",
    pickup_location_label: "OOU Main Gate",
    dropoff_location_title: "Oshodi",
    dropoff_location_locality: "Oshodi-Isolo",
    dropoff_location_label: "Oshodi Terminal",
    meeting_point: "Main Gate",
    priceCar: 4000,
    priceBus: 2500,
    departure_time: "14:00:00",
    arrival_time: "16:00:00",
    status: "active",
  }).returning();
  return record.id;
}

async function clearExistingData() {
  await db.delete(refund);
  await db.delete(payment);
  await db.delete(earning);
  await db.delete(externalDriver);
  await db.delete(booking);
  await db.delete(trip);
}

async function findOrCreateDriver() {
  const existing = await db.query.driver.findFirst({
    where: (d, { eq }) => eq(d.email, DRIVER_EMAIL),
  });
  if (existing) return existing;

  const [record] = await db.insert(driver).values({
    userId: ADEBOLA_USER_ID,
    firstName: "Emeka",
    lastName: "Okafor",
    email: DRIVER_EMAIL,
    phone: "+2348023456789",
    country: "Nigeria",
    currency: "NGN",
    state: "Lagos",
    city: "Ikeja",
    address: "15 Admiralty Way, Lekki Phase 1",
    bankName: "Access Bank",
    bankCode: "044",
    accountNumber: "0234567890",
    accountName: "Emeka Okafor",
    bankVerificationStatus: "active",
    bankVerifiedAt: new Date("2026-05-01"),
    kycStatus: "active",
    kycVerifiedAt: new Date("2026-05-01"),
    isActive: true,
  }).returning();
  return record;
}

async function findOrCreateStats(driverId: string) {
  const existing = await db.query.driverStats.findFirst({
    where: (s, { eq }) => eq(s.driverId, driverId),
  });
  if (existing) return;

  await db.insert(driverStats).values({
    driverId,
    totalEarnings: 250000,
    pendingPayments: 0,
    inReviewPayments: 0,
    totalPassengers: 78,
  });
}

async function findOrCreateVehicle(driverId: string) {
  const existing = await db.query.vehicle.findFirst({
    where: (v, { eq }) => eq(v.plateNumber, "LAG 789 XZ"),
  });
  if (existing) return existing;

  const [record] = await db.insert(vehicle).values({
    driverId,
    plateNumber: "LAG 789 XZ",
    make: "Toyota",
    model: "Hiace",
    capacity: 14,
    color: "White",
  }).returning();
  return record;
}

const PASSENGER_USERS = [
  { firstName: "Chioma", lastName: "Okonkwo", email: "chioma.o@example.com" },
  { firstName: "Tunde", lastName: "Balogun", email: "tunde.b@example.com" },
  { firstName: "Fatima", lastName: "Yusuf", email: "fatima.y@example.com" },
  { firstName: "Chidi", lastName: "Okafor", email: "chidi.o@example.com" },
  { firstName: "Ngozi", lastName: "Eze", email: "ngozi.e@example.com" },
];

async function findOrCreatePassengerUsers() {
  const ids: string[] = [];
  for (const p of PASSENGER_USERS) {
    const existing = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, p.email),
    });
    if (existing) {
      ids.push(existing.id);
    } else {
      const [created] = await db.insert(users).values({
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        dateOfBirth: new Date("1995-01-01"),
      }).returning();
      ids.push(created.id);
    }
  }
  return ids;
}

async function createTripsAndBookings(driverId: string, vehicleId: string) {
  const ROUTE_LAGOS_IBADAN = await lookupRoute("Lagos", "Ibadan");
  const ROUTE_UI_OJOTA = await lookupRoute("UI Main Gate", "Ojota");
  const userIds = await findOrCreatePassengerUsers();

  // ── Trip A: awaiting_driver – Lagos→Ibadan, Jul 12, bus, 5/14 seats ──
  const [tripA] = await db.insert(trip).values({
    routeId: ROUTE_LAGOS_IBADAN,
    date: new Date("2026-07-12"),
    vehicleType: "bus",
    capacity: 14,
    bookedSeats: 5,
    status: "awaiting_driver",
  }).returning();

  for (let seat = 1; seat <= 5; seat++) {
    const user = PASSENGER_USERS[seat - 1];
    await db.insert(booking).values({
      routeId: ROUTE_LAGOS_IBADAN,
      tripDate: new Date("2026-07-12"),
      vehicleType: "bus",
      tripId: tripA.id,
      userId: userIds[seat - 1],
      seatNumber: seat,
      firstName: user.firstName,
      lastName: user.lastName,
      fareAmount: 3000,
      currency: "NGN",
      status: "confirmed",
      paymentStatus: "paid",
    });
  }

  // ── Trip B: awaiting_driver – UI→Ojota, Jul 14, car, 3/7 seats ──
  const [tripB] = await db.insert(trip).values({
    routeId: ROUTE_UI_OJOTA,
    date: new Date("2026-07-14"),
    vehicleType: "car",
    capacity: 7,
    bookedSeats: 3,
    status: "awaiting_driver",
  }).returning();

  for (let seat = 1; seat <= 3; seat++) {
    const user = PASSENGER_USERS[seat - 1];
    await db.insert(booking).values({
      routeId: ROUTE_UI_OJOTA,
      tripDate: new Date("2026-07-14"),
      vehicleType: "car",
      tripId: tripB.id,
      userId: userIds[seat - 1],
      seatNumber: seat,
      firstName: user.firstName,
      lastName: user.lastName,
      fareAmount: 5000,
      currency: "NGN",
      status: "confirmed",
      paymentStatus: "paid",
    });
  }

  // ── Trip C: driver-assigned – Lagos→Ibadan, Jun 28, bus, 3/14 seats ──
  const [tripC] = await db.insert(trip).values({
    routeId: ROUTE_LAGOS_IBADAN,
    driverId,
    date: new Date("2026-06-28"),
    vehicleType: "bus",
    capacity: 14,
    bookedSeats: 3,
    status: "confirmed",
    vehicleId,
    driverClaimedAt: new Date("2026-06-27T07:00:00"),
  }).returning();

  for (let seat = 1; seat <= 3; seat++) {
    const user = PASSENGER_USERS[seat - 1];
    await db.insert(booking).values({
      routeId: ROUTE_LAGOS_IBADAN,
      tripDate: new Date("2026-06-28"),
      vehicleType: "bus",
      tripId: tripC.id,
      userId: userIds[seat - 1],
      seatNumber: seat,
      firstName: user.firstName,
      lastName: user.lastName,
      fareAmount: 3000,
      currency: "NGN",
      status: "confirmed",
      paymentStatus: "paid",
    });
  }

  // ── Trip D: driver-assigned – Lagos→Ibadan, Jul 10, bus, 2/14 seats ──
  const [tripD] = await db.insert(trip).values({
    routeId: ROUTE_LAGOS_IBADAN,
    driverId,
    date: new Date("2026-07-10"),
    vehicleType: "bus",
    capacity: 14,
    bookedSeats: 2,
    status: "confirmed",
    vehicleId,
    driverClaimedAt: new Date("2026-07-09T07:00:00"),
  }).returning();

  for (let seat = 1; seat <= 2; seat++) {
    const user = PASSENGER_USERS[seat - 1];
    await db.insert(booking).values({
      routeId: ROUTE_LAGOS_IBADAN,
      tripDate: new Date("2026-07-10"),
      vehicleType: "bus",
      tripId: tripD.id,
      userId: userIds[seat - 1],
      seatNumber: seat,
      firstName: user.firstName,
      lastName: user.lastName,
      fareAmount: 3000,
      currency: "NGN",
      status: "confirmed",
      paymentStatus: "paid",
    });
  }

  // ── Trip E: awaiting_driver – OOU→Oshodi (afternoon), Jul 18, bus, 4/14 seats ──
  const ROUTE_OOU_OSHODI = await findOrCreateOouOshodiRoute();
  const [tripE] = await db.insert(trip).values({
    routeId: ROUTE_OOU_OSHODI,
    date: new Date("2026-07-18T14:00:00"),
    vehicleType: "bus",
    capacity: 14,
    bookedSeats: 4,
    status: "awaiting_driver",
  }).returning();

  for (let seat = 1; seat <= 4; seat++) {
    const user = PASSENGER_USERS[seat - 1];
    await db.insert(booking).values({
      routeId: ROUTE_OOU_OSHODI,
      tripDate: new Date("2026-07-18T14:00:00"),
      vehicleType: "bus",
      tripId: tripE.id,
      userId: userIds[seat - 1],
      seatNumber: seat,
      firstName: user.firstName,
      lastName: user.lastName,
      fareAmount: 2500,
      currency: "NGN",
      status: "confirmed",
      paymentStatus: "paid",
    });
  }

  return { tripA, tripB, tripC, tripD, tripE };
}

async function main() {
  await clearExistingData();

  const driverRecord = await findOrCreateDriver();
  const DRIVER_ID = driverRecord.id;
  await findOrCreateStats(DRIVER_ID);
  const vehicleRecord = await findOrCreateVehicle(DRIVER_ID);
  const VEHICLE_ID = vehicleRecord.id;

  const trips = await createTripsAndBookings(DRIVER_ID, VEHICLE_ID);

  console.log("Seed data created successfully!");
  console.log(`  Driver:               ${driverRecord.firstName} ${driverRecord.lastName} (${DRIVER_ID})`);
  console.log(`  Vehicle:              ${vehicleRecord.make} ${vehicleRecord.model} (${VEHICLE_ID})`);
  console.log(`  Trip A (awaiting_driver, Jul 12, bus, 5/14): ${trips.tripA.id}`);
  console.log(`  Trip B (awaiting_driver, Jul 14, car, 3/7):  ${trips.tripB.id}`);
  console.log(`  Trip C (driver-assigned, Jun 28, bus, 3/14): ${trips.tripC.id}`);
  console.log(`  Trip D (driver-assigned, Jul 10, bus, 2/14): ${trips.tripD.id}`);
  console.log(`  Trip E (awaiting_driver, Jul 18, bus, 4/14): ${trips.tripE.id}`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
