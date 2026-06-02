import { lte, relations, sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
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
  "luxury car",
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
  "booking_closed",
]);

export const route = pgTable(
  "route",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id").references(() => driver.id, { onDelete: "restrict" }).notNull(),
    pickup_location_title: text("pickup_location_title").notNull(),
    pickup_location_locality: text("pickup_location_locality").notNull(),
    pickup_location_label: text("pickup_location_label").notNull(),
    dropoff_location_title: text("dropoff_location_title").notNull(),
    dropoff_location_locality: text("dropoff_location_locality").notNull(),
    dropoff_location_label: text("dropoff_location_label").notNull(),
    intermediate_stops_title: text("intermediate_stops_title"),
    intermediate_stops_locality: text("intermediate_stops_locality"),
    intermediate_stops_label: text("intermediate_stops_label"),
    vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
    meeting_point: text("meeting_point").notNull(),
    availableSeats: integer("available_seats").notNull(),
    price: bigint("price", { mode: "number" }).notNull(),
    departure_time: timestamp("departure_time", { mode: "date" }).notNull(),
    arrival_time: timestamp("arrival_time", { mode: "date" }).notNull(),
    status: statusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("route_driver_origin_destination_departure_unique_idx").on(
      table.driverId,
      table.pickup_location_title,
      table.pickup_location_locality,
      table.pickup_location_label,
      table.dropoff_location_title,
      table.dropoff_location_locality,
      table.dropoff_location_label,
      table.departure_time,
    ),
    index("route_driver_created_at_idx").on(
      table.driverId,
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
    driverId: uuid("driver_id").references(() => driver.id, { onDelete: "restrict" }).notNull(),
    date: timestamp("date", { mode: "date" }).notNull(),

    capacity: integer("capacity").notNull(),

    bookedSeats: integer("booked_seats").default(0).notNull(),

    status: tripStatusEnum("status").default("pending").notNull(),

    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("trip_driver_date_idx").on(table.driverId, table.date),
    uniqueIndex("trip_route_date_unique_idx").on(table.routeId, table.date),
    index("trip_route_date_idx").on(table.routeId, table.date),
    check("trip_booked_seats_check", lte(table.bookedSeats, table.capacity)),
  ],
);

export const booking = pgTable(
  "booking",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id").references(() => trip.id, { onDelete: "restrict" }).notNull(),
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
    index("booking_payment_reference_idx").on(table.paymentReference),
    index("booking_expires_at_idx").on(table.expiresAt),
    index("booking_user_visible_created_at_idx")
      .on(table.userId, table.createdAt.desc())
      .where(
        sql`${table.status} in ('confirmed', 'completed') and ${table.paymentStatus} not in ('failed', 'cancelled', 'expired')`,
      ),
    uniqueIndex("booking_trip_id_user_id_active_idx")
      .on(table.tripId, table.userId)
      .where(sql`${table.status} in ('pending', 'confirmed')`),
    uniqueIndex("booking_trip_id_seat_number_active_idx")
      .on(table.tripId, table.seatNumber)
      .where(
        sql`${table.seatNumber} is not null and ${table.status} in ('pending', 'confirmed')`,
      ),
  ],
);

export const routeRelations = relations(route, ({ many }) => ({
  trips: many(trip),
}));

export const tripRelations = relations(trip, ({ one, many }) => ({
  route: one(route, {
    fields: [trip.routeId],
    references: [route.id],
  }),
  bookings: many(booking),
}));

export const bookingRelations = relations(booking, ({ one }) => ({
  trip: one(trip, {
    fields: [booking.tripId],
    references: [trip.id],
  }),
}));

export const routeSchema = {
  route,
  trip,
  booking,
};

export type Route = typeof route.$inferSelect;
export type Trip = typeof trip.$inferSelect;
export type Booking = typeof booking.$inferSelect;
