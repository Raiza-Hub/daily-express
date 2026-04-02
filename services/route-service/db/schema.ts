import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

//update vehicleEnum to bus, car, luxury_car
export const statusEnum = pgEnum("status", ["inactive", "pending", "active"]);
export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "car",
  "bus",
  "luxury_car",
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
]);

//add filter search like mongo in services
//store location as object {title, locality}
export const route = pgTable("route", {
  id: uuid("id").defaultRandom().primaryKey(),
  driverId: uuid("driver_id").notNull(),
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
  price: integer("price").notNull(),
  departure_time: timestamp("departure_time").notNull(),
  arrival_time: timestamp("arrival_time").notNull(),
  status: statusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const trip = pgTable("trip", {
  id: uuid("id").defaultRandom().primaryKey(),
  routeId: uuid("route_id").notNull(),
  driverId: uuid("driver_id").notNull(),
  date: timestamp("date").notNull(),
  capacity: integer("capacity").notNull(),
  bookedSeats: integer("booked_seats").default(0).notNull(),
  status: tripStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const booking = pgTable("booking", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").notNull(),
  userId: uuid("user_id").notNull(),
  seatNumber: integer("seat_number").notNull(),
  status: tripStatusEnum("status").default("pending").notNull(),
  paymentReference: varchar("payment_reference", { length: 128 }),
  paymentStatus: varchar("payment_status", { length: 32 })
    .default("initialized")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
}));

export const bookingRelations = relations(booking, ({ one }) => ({
  trip: one(trip, {
    fields: [booking.tripId],
    references: [trip.id],
  }),
}));

export const schema = {
  route,
  trip,
  booking,
};
