import "dotenv/config";
import { db } from "../db/connection";
import { booking, driver, trip, vehicle } from "../db/index";

const ADEBOLA_USER_ID = "e6eacda7-8318-4724-8efe-641acf7f9c92";
const DRIVER_EMAIL = "emeka.okafor@example.com";

async function lookupRoute(pickup: string, dropoff: string, departureTime?: string) {
  const condition: Record<string, unknown> = {
    pickup_location_title: pickup,
    dropoff_location_title: dropoff,
  };
  if (departureTime) condition.departure_time = departureTime;

  const found = await db.query.route.findFirst({
    where: (r, { and, eq }) => {
      const conditions = [eq(r.pickup_location_title, pickup), eq(r.dropoff_location_title, dropoff)];
      if (departureTime) conditions.push(eq(r.departure_time, departureTime));
      return and(...conditions);
    },
  });
  if (!found) throw new Error(`Route not found: ${pickup} → ${dropoff}${departureTime ? ` at ${departureTime}` : ""}`);
  return found.id;
}

async function main() {
  const existingDriver = await db.query.driver.findFirst({
    where: (d, { eq }) => eq(d.email, DRIVER_EMAIL),
  });
  if (!existingDriver) throw new Error(`Driver not found: ${DRIVER_EMAIL}. Run db:seed first.`);

  const DRIVER_ID = existingDriver.id;

  const existingVehicle = await db.query.vehicle.findFirst({
    where: (v, { eq }) => eq(v.driverId, DRIVER_ID),
  });
  if (!existingVehicle) throw new Error(`Vehicle not found for driver. Run db:seed first.`);

  const VEHICLE_ID = existingVehicle.id;

  const ROUTE_LAGOS_IBADAN = await lookupRoute("Lagos", "Ibadan", "08:00:00");
  const ROUTE_UI_OJOTA = await lookupRoute("UI Main Gate", "Ojota", "07:30:00");
  const ROUTE_IKEJA_VI = await lookupRoute("Ikeja", "Victoria Island", "07:00:00");
  const ROUTE_ABEOKUTA_LAGOS = await lookupRoute("Abeokuta", "Lagos", "06:00:00");

  // ── Trip A: driver-assigned – Lagos→Ibadan, Jul 30, bus ──
  const [tripA] = await db.insert(trip).values({
    routeId: ROUTE_LAGOS_IBADAN,
    driverId: DRIVER_ID,
    date: new Date("2026-07-30"),
    vehicleType: "bus",
    capacity: 14,
    bookedSeats: 1,
    status: "confirmed",
    vehicleId: VEHICLE_ID,
    driverClaimedAt: new Date("2026-07-29T07:00:00"),
  }).returning();

  await db.insert(booking).values({
    routeId: ROUTE_LAGOS_IBADAN,
    tripDate: new Date("2026-07-30"),
    vehicleType: "bus",
    tripId: tripA.id,
    userId: ADEBOLA_USER_ID,
    seatNumber: 1,
    firstName: "Adebola",
    lastName: "Wisdom",
    fareAmount: 3000,
    currency: "NGN",
    status: "confirmed",
    paymentStatus: "paid",
  });

  // ── Trip B: awaiting_driver – UI→Ojota, Aug 2, car ──
  const [tripB] = await db.insert(trip).values({
    routeId: ROUTE_UI_OJOTA,
    date: new Date("2026-08-02"),
    vehicleType: "car",
    capacity: 7,
    bookedSeats: 1,
    status: "awaiting_driver",
  }).returning();

  await db.insert(booking).values({
    routeId: ROUTE_UI_OJOTA,
    tripDate: new Date("2026-08-02"),
    vehicleType: "car",
    tripId: tripB.id,
    userId: ADEBOLA_USER_ID,
    seatNumber: 1,
    firstName: "Adebola",
    lastName: "Wisdom",
    fareAmount: 12000,
    currency: "NGN",
    status: "confirmed",
    paymentStatus: "paid",
  });

  // ── Trip C: driver-assigned – Ikeja→VI, Aug 5, car ──
  const [tripC] = await db.insert(trip).values({
    routeId: ROUTE_IKEJA_VI,
    driverId: DRIVER_ID,
    date: new Date("2026-08-05"),
    vehicleType: "car",
    capacity: 7,
    bookedSeats: 1,
    status: "confirmed",
    vehicleId: VEHICLE_ID,
    driverClaimedAt: new Date("2026-08-04T06:00:00"),
  }).returning();

  await db.insert(booking).values({
    routeId: ROUTE_IKEJA_VI,
    tripDate: new Date("2026-08-05"),
    vehicleType: "car",
    tripId: tripC.id,
    userId: ADEBOLA_USER_ID,
    seatNumber: 1,
    firstName: "Adebola",
    lastName: "Wisdom",
    fareAmount: 3000,
    currency: "NGN",
    status: "confirmed",
    paymentStatus: "paid",
  });

  // ── Trip D: awaiting_driver – Abeokuta→Lagos, Aug 8, bus ──
  const [tripD] = await db.insert(trip).values({
    routeId: ROUTE_ABEOKUTA_LAGOS,
    date: new Date("2026-08-08"),
    vehicleType: "bus",
    capacity: 14,
    bookedSeats: 1,
    status: "awaiting_driver",
  }).returning();

  await db.insert(booking).values({
    routeId: ROUTE_ABEOKUTA_LAGOS,
    tripDate: new Date("2026-08-08"),
    vehicleType: "bus",
    tripId: tripD.id,
    userId: ADEBOLA_USER_ID,
    seatNumber: 1,
    firstName: "Adebola",
    lastName: "Wisdom",
    fareAmount: 3500,
    currency: "NGN",
    status: "confirmed",
    paymentStatus: "paid",
  });

  console.log("Adebola's bookings created successfully!");
  console.log(`  Trip A (driver-assigned, Lagos→Ibadan, Jul 30, bus): ${tripA.id}`);
  console.log(`  Trip B (awaiting_driver,  UI→Ojota,     Aug 2,  car): ${tripB.id}`);
  console.log(`  Trip C (driver-assigned, Ikeja→VI,      Aug 5,  car): ${tripC.id}`);
  console.log(`  Trip D (awaiting_driver,  Abeokuta→Lagos,Aug 8,  bus): ${tripD.id}`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
