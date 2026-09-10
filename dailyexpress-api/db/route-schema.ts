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
    origin_title: text("origin_title").notNull(),
    origin_locality: text("origin_locality").notNull(),
    origin_label: text("origin_label").notNull(),
    destination_title: text("destination_title"),
    destination_locality: text("destination_locality"),
    destination_label: text("destination_label"),
    train_station_title: text("train_station_title"),
    train_station_locality: text("train_station_locality"),
    train_station_label: text("train_station_label"),
    pickup_point: text("pickup_point").notNull(),
    dropoff_point: text("dropoff_point").notNull(),
    price: bigint("price", { mode: "number" }).notNull(),
    fee: bigint("fee", { mode: "number" }),
    luggage_fee: bigint("luggage_fee", { mode: "number" }).notNull(),
    departure_time: time("departure_time").array().notNull(),
    arrival_time: time("arrival_time").array().notNull(),
    status: statusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("route_origin_unique_idx").on(
      table.origin_title,
      table.origin_locality,
      table.origin_label,
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
    departureTime: time("departure_time").notNull(),
    arrivalTime: time("arrival_time").notNull(),
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
    uniqueIndex("trip_route_driver_date_departure_unique_idx").on(
      table.routeId,
      table.driverId,
      table.date,
      table.departureTime,
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
    departureTime: time("departure_time").notNull(),
    arrivalTime: time("arrival_time").notNull(),
    boardingPoint: text("boarding_point", {
      enum: ["pickup", "dropoff"],
    }).default("pickup").notNull(),
    luggageCount: integer("luggage_count").default(0).notNull(),
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
      .on(
        table.routeId,
        table.tripDate,
        table.userId,
        table.vehicleType,
        table.departureTime,
      )
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
