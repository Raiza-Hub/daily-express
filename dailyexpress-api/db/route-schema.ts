import { lte, relations, sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
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
import { driver } from "./driver-schema";
import { users } from "./auth-schema";

export const statusEnum = pgEnum("status", ["inactive", "pending", "active"]);
export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "car",
  "bus",
]);

export interface LocationObject {
  title: string;
  locality: string;
  label: string;
}

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
    index("route_created_at_idx").on(
      table.createdAt.desc(),
    ),
    index("pickup_location_title_trgm_idx").using(
      "gin",
      table.pickup_location_title.op("gin_trgm_ops"),
    ),
    index("pickup_location_locality_trgm_idx").using(
      "gin",
      table.pickup_location_locality.op("gin_trgm_ops"),
    ),
    index("pickup_location_label_trgm_idx").using(
      "gin",
      table.pickup_location_label.op("gin_trgm_ops"),
    ),
    index("dropoff_location_title_trgm_idx").using(
      "gin",
      table.dropoff_location_title.op("gin_trgm_ops"),
    ),
    index("dropoff_location_locality_trgm_idx").using(
      "gin",
      table.dropoff_location_locality.op("gin_trgm_ops"),
    ),
    index("dropoff_location_label_trgm_idx").using(
      "gin",
      table.dropoff_location_label.op("gin_trgm_ops"),
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
    index("trip_driver_date_idx").on(table.driverId, table.date),
    index("trip_route_date_vt_idx").on(table.routeId, table.date, table.vehicleType),
    check("trip_booked_seats_check", lte(table.bookedSeats, table.capacity)),
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
    seatNumber: integer("seat_number"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    fareAmount: bigint("fare_amount", { mode: "number" }).default(0).notNull(),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    status: tripStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    paymentReference: varchar("payment_reference", { length: 128 }),
    paymentStatus: varchar("payment_status", { length: 32 })
      .default("initialized")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("booking_trip_id_idx").on(table.tripId),
    index("booking_user_id_idx").on(table.userId),
    index("booking_route_date_vt_idx").on(table.routeId, table.tripDate, table.vehicleType),
    index("booking_payment_reference_idx").on(table.paymentReference),
    index("booking_expires_at_idx").on(table.expiresAt),
    index("booking_user_visible_created_at_idx")
      .on(table.userId, table.createdAt.desc())
      .where(
        sql`${table.status} in ('confirmed', 'completed') and ${table.paymentStatus} not in ('failed', 'cancelled', 'expired')`,
      ),
    uniqueIndex("booking_route_user_vt_active_idx")
      .on(table.routeId, table.tripDate, table.userId, table.vehicleType)
      .where(sql`${table.status} in ('pending', 'confirmed')`),
    uniqueIndex("booking_trip_id_seat_number_active_idx")
      .on(table.tripId, table.seatNumber)
      .where(
        sql`${table.seatNumber} is not null and ${table.status} in ('pending', 'confirmed')`,
      ),
  ],
);

export const vehicle = pgTable("vehicle", {
  id: uuid("id").defaultRandom().primaryKey(),
  driverId: uuid("driver_id")
    .references(() => driver.id, { onDelete: "cascade" })
    .notNull(),
  plateNumber: text("plate_number").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  capacity: integer("capacity").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  index("vehicle_driver_id_idx").on(table.driverId),
]);

export const externalDriver = pgTable("external_driver", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id")
    .references(() => trip.id, { onDelete: "restrict" })
    .notNull()
    .unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  country: text("country"),
  state: text("state"),
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  vehiclePlateNumber: text("vehicle_plate_number"),
  vehicleColor: text("vehicle_color"),
  vehicleCapacity: integer("vehicle_capacity"),
  assignedBy: text("assigned_by").notNull(),
  assignedAt: timestamp("assigned_at", { mode: "date" }).defaultNow().notNull(),
});

export const routeRelations = relations(route, ({ many }) => ({
  trips: many(trip),
}));

export const tripRelations = relations(trip, ({ one, many }) => ({
  route: one(route, {
    fields: [trip.routeId],
    references: [route.id],
  }),
  bookings: many(booking),
  externalDrivers: many(externalDriver),
  vehicle: one(vehicle, {
    fields: [trip.vehicleId],
    references: [vehicle.id],
  }),
}));

export const bookingRelations = relations(booking, ({ one }) => ({
  trip: one(trip, {
    fields: [booking.tripId],
    references: [trip.id],
  }),
}));

export const externalDriverRelations = relations(externalDriver, ({ one }) => ({
  trip: one(trip, {
    fields: [externalDriver.tripId],
    references: [trip.id],
  }),
}));

export const vehicleRelations = relations(vehicle, ({ one }) => ({
  ownerDriver: one(driver, {
    fields: [vehicle.driverId],
    references: [driver.id],
  }),
}));

export const VEHICLE_CAPACITY: Record<string, number> = {
  car: 7,
  bus: 14,
} as const;

export const routeSchema = {
  route,
  trip,
  booking,
  vehicle,
  externalDriver,
};

export type Route = typeof route.$inferSelect;
export type RouteRecord = Route;
export type Trip = typeof trip.$inferSelect;
export type TripRecord = Trip;
export type Booking = typeof booking.$inferSelect;
export type BookingRecord = Booking;
export type Vehicle = typeof vehicle.$inferSelect;
export type VehicleRecord = Vehicle;
export type ExternalDriver = typeof externalDriver.$inferSelect;
export type ExternalDriverRecord = ExternalDriver;
