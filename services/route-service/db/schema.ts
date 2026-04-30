import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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
  "booking_closed",
]);

export const route = pgTable(
  "route",
  {
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
    index("pickup_location_title_trgm_idx").using(
      "gin",
      sql`${table.pickup_location_title} gin_trgm_ops`,
    ),
    index("pickup_location_locality_trgm_idx").using(
      "gin",
      sql`${table.pickup_location_locality} gin_trgm_ops`,
    ),
    index("pickup_location_label_trgm_idx").using(
      "gin",
      sql`${table.pickup_location_label} gin_trgm_ops`,
    ),
    index("dropoff_location_title_trgm_idx").using(
      "gin",
      sql`${table.dropoff_location_title} gin_trgm_ops`,
    ),
    index("dropoff_location_locality_trgm_idx").using(
      "gin",
      sql`${table.dropoff_location_locality} gin_trgm_ops`,
    ),
    index("dropoff_location_label_trgm_idx").using(
      "gin",
      sql`${table.dropoff_location_label} gin_trgm_ops`,
    ),
  ],
);


export const trip = pgTable(
  "trip",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    routeId: uuid("route_id").notNull(),

    driverId: uuid("driver_id").notNull(),

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
    sql`CONSTRAINT trip_booked_seats_check CHECK (booked_seats <= capacity)`,
  ],
);

export const booking = pgTable(
  "booking",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id").notNull(),
    userId: uuid("user_id").notNull(),
    seatNumber: integer("seat_number"),
    lastName: text("last_name"),
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
    uniqueIndex("booking_trip_id_user_id_active_idx")
      .on(table.tripId, table.userId)
      .where(sql`${table.status} in ('pending', 'confirmed')`),
    uniqueIndex("booking_trip_id_seat_number_active_idx")
      .on(table.tripId, table.seatNumber)
      .where(sql`seat_number IS NOT NULL`),
  ],
);

export const driverIdentity = pgTable(
  "driver_identity",
  {
    driverId: uuid("driver_id").primaryKey(),
    userId: uuid("user_id").notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone").notNull(),
    profilePictureUrl: text("profile_picture_url"),
    country: text("country").notNull(),
    state: text("state").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    sourceOccurredAt: timestamp("source_occurred_at", { mode: "date" })
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("driver_identity_user_id_idx").on(table.userId),
    index("driver_identity_source_occurred_at_idx").on(table.sourceOccurredAt),
  ],
);

export const passengerIdentity = pgTable(
  "passenger_identity",
  {
    userId: uuid("user_id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    sourceOccurredAt: timestamp("source_occurred_at", { mode: "date" })
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("passenger_identity_email_idx").on(table.email),
    index("passenger_identity_source_occurred_at_idx").on(table.sourceOccurredAt),
  ],
);

export const consumedEvent = pgTable(
  "consumed_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: varchar("event_id", { length: 128 }).notNull().unique(),
    topic: varchar("topic", { length: 128 }).notNull(),
    processedAt: timestamp("processed_at", { mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("consumed_event_topic_processed_at_idx").on(
      table.topic,
      table.processedAt.desc(),
    ),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id").notNull().unique(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").default(1),
    payload: jsonb("payload").notNull(),
    headers: jsonb("headers"),
    traceId: text("trace_id"),
    spanId: text("span_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    processingStartedAt: timestamp("processing_started_at", { mode: "date" }),
    publishedAt: timestamp("published_at", { mode: "date" }),
    status: text("status").default("PENDING"),
    retryCount: integer("retry_count").default(0),
    nextRetryAt: timestamp("next_retry_at", { mode: "date" }),
    lastError: text("last_error"),
    lockedAt: timestamp("locked_at", { mode: "date" }),
    lockedBy: text("locked_by"),
  },
  (table) => [
    index("outbox_lookup_idx").on(
      table.status,
      table.nextRetryAt,
      table.createdAt,
    ),
    index("outbox_published_idx").on(table.publishedAt),
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

export const schema = {
  route,
  trip,
  booking,
  driverIdentity,
  passengerIdentity,
  consumedEvent,
  outboxEvents,
};

export type OutboxEvent = typeof outboxEvents.$inferSelect;
