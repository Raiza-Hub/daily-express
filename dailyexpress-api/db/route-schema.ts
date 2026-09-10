import { lte, sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema";
import { driver } from "./driver-schema";

export const statusEnum = pgEnum("status", ["inactive", "pending", "active"]);
export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "car",
  "bus",
]);

export const tripStatusEnum = pgEnum("trip_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "awaiting_driver",
]);

export const route = pgTable(
  "route",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pickup_location_title: text("pickup_location_title").notNull(),
    pickup_location_locality: text("pickup_location_locality").notNull(),
    pickup_location_label: text("pickup_location_label").notNull(),
    dropoff_location_title: text("dropoff_location_title").notNull(),
    dropoff_location_locality: text("dropoff_location_locality").notNull(),
    dropoff_location_label: text("dropoff_location_label").notNull(),
    intermediate_stops_title: text("intermediate_stops_title"),
    intermediate_stops_locality: text("intermediate_stops_locality"),
    intermediate_stops_label: text("intermediate_stops_label"),
    meeting_point: text("meeting_point").notNull(),
    priceCar: bigint("price_car", { mode: "number" }).notNull(),
    priceBus: bigint("price_bus", { mode: "number" }).notNull(),
    fee: bigint("fee", { mode: "number" }),
    departure_time: time("departure_time").notNull(),
    arrival_time: time("arrival_time").notNull(),
    status: statusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("route_origin_destination_departure_unique_idx").on(
      table.pickup_location_title,
      table.pickup_location_locality,
      table.pickup_location_label,
      table.dropoff_location_title,
      table.dropoff_location_locality,
      table.dropoff_location_label,
      table.departure_time,
    ),
  ],
);

export const trip = pgTable(
  "trip",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    routeId: uuid("route_id").references(() => route.id, { onDelete: "restrict" }).notNull(),
    driverId: uuid("driver_id").references(() => driver.id, { onDelete: "restrict" }),
    date: timestamp("date", { mode: "date" }).notNull(),
    vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
    capacity: integer("capacity").notNull(),
    bookedSeats: integer("booked_seats").default(0).notNull(),
    status: tripStatusEnum("status").default("awaiting_driver").notNull(),
    driverClaimedAt: timestamp("driver_claimed_at", { mode: "date" }),
    vehicleId: uuid("vehicle_id").references(() => vehicle.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("trip_route_driver_date_unique_idx").on(
      table.routeId,
      table.driverId,
      table.date,
    ),
    check("trip_booked_seats_not_over_capacity_check", lte(table.bookedSeats, table.capacity)),
  ],
);

export const booking = pgTable(
  "booking",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    routeId: uuid("route_id").references(() => route.id, { onDelete: "restrict" }).notNull(),
    tripDate: timestamp("trip_date", { mode: "date" }).notNull(),
    vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
    tripId: uuid("trip_id").references(() => trip.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    seatCount: integer("seat_count").default(1).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    fareAmount: bigint("fare_amount", { mode: "number" }).default(0).notNull(),
    feeAmount: bigint("fee_amount", { mode: "number" }).default(0).notNull(),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    status: tripStatusEnum("status").default("pending").notNull(),

    paymentReference: varchar("payment_reference", { length: 128 }),
    paymentStatus: varchar("payment_status", { length: 32 })
      .default("initialized")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("booking_route_date_user_vehicletype_active_idx")
      .on(table.routeId, table.tripDate, table.userId, table.vehicleType)
      .where(sql`${table.status} in ('pending', 'confirmed')`),
  ],
);

export const vehicle = pgTable("vehicle", {
  id: uuid("id").defaultRandom().primaryKey(),
  driverId: uuid("driver_id")
    .references(() => driver.id, { onDelete: "cascade" })
    .notNull(),
  vehicleType: vehicleTypeEnum("vehicle_type"),
  plateNumber: text("plate_number").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  capacity: integer("capacity").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const VEHICLE_CAPACITY: Record<string, number> = {
  car: 7,
  bus: 14,
} as const;

export const routeSchema = {
  route,
  trip,
  booking,
  vehicle,
};

export type Route = typeof route.$inferSelect;
export type RouteRecord = Route;
export type Trip = typeof trip.$inferSelect;
export type TripRecord = Trip;
export type Booking = typeof booking.$inferSelect;
export type BookingRecord = Booking;
export type Vehicle = typeof vehicle.$inferSelect;
export type VehicleRecord = Vehicle;
