import { lte, sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  bigint,
  check,
  date,
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

export const tripStatusEnum = pgEnum("trip_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "awaiting_driver",
]);

export const origin = pgTable(
  "origin",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    locality: text("locality").notNull(),
    meetingPoint: text("meeting_point").notNull(),
    departureTime: time("departure_time").array().notNull(),
    price: bigint("price", { mode: "number" }).notNull(),
    fee: bigint("fee", { mode: "number" }).notNull(),
    luggageFee: bigint("luggage_fee", { mode: "number" }).notNull(),
    destinationIds: uuid("destination_ids").array().notNull(),
    status: statusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("origin_title_locality_unique_idx").on(
      table.title,
      table.locality,
    ),
  ],
);

export const destination = pgTable(
  "destination",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    locality: text("locality").notNull(),
    status: statusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("destination_title_locality_unique_idx").on(
      table.title,
      table.locality,
    ),
  ],
);

export const trip = pgTable(
  "trip",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    originId: uuid("origin_id").references(() => origin.id, { onDelete: "restrict" }).notNull(),
    destinationId: uuid("destination_id").references(() => destination.id, { onDelete: "restrict" }).notNull(),
    driverId: uuid("driver_id").references(() => driver.id, { onDelete: "restrict" }),
    date: date("date").notNull(),
    departureTime: time("departure_time").notNull(),
    capacity: integer("capacity").notNull(),
    bookedSeats: integer("booked_seats").default(0).notNull(),
    status: tripStatusEnum("status").default("awaiting_driver").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("trip_origin_destination_driver_date_departure_unique_idx").on(
      table.originId,
      table.destinationId,
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
    originId: uuid("origin_id").references(() => origin.id, { onDelete: "restrict" }).notNull(),
    destinationId: uuid("destination_id").references(() => destination.id, { onDelete: "restrict" }).notNull(),
    tripDate: date("trip_date").notNull(),
    departureTime: time("departure_time").notNull(),
    luggageCount: integer("luggage_count").default(0).notNull(),
    tripId: uuid("trip_id").references(() => trip.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    totalAmount: bigint("total_amount", { mode: "number" }).default(0).notNull(),
    totalFee: bigint("total_fee", { mode: "number" }).default(0).notNull(),
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
    uniqueIndex("booking_origin_destination_date_user_departure_active_idx")
      .on(
        table.originId,
        table.destinationId,
        table.tripDate,
        table.userId,
        table.departureTime,
      )
      .where(sql`${table.status} in ('pending', 'confirmed')`),
  ],
);

export const TRIP_CAPACITY = 4;

export const bookingRelations = relations(booking, ({ one }) => ({
  origin: one(origin, {
    fields: [booking.originId],
    references: [origin.id],
  }),
}));

export const routeSchema = {
  origin,
  destination,
  trip,
  booking,
  bookingRelations,
};

export type Origin = typeof origin.$inferSelect;
export type OriginRecord = Origin;
export type Destination = typeof destination.$inferSelect;
export type DestinationRecord = Destination;
export type Trip = typeof trip.$inferSelect;
export type TripRecord = Trip;
export type Booking = typeof booking.$inferSelect;
export type BookingRecord = Booking;
