import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { driver } from "./driver-schema";
import { trip } from "./route-schema";

export const tripDispatchStatusEnum = pgEnum("trip_dispatch_status", [
  "pending",
  "searching",
  "assigned",
  "cancelled",
]);

export const driverDispatchAttemptStatusEnum = pgEnum(
  "driver_dispatch_attempt_status",
  ["dialing", "awaiting_dtmf", "accepted", "declined", "unavailable"],
);

export const tripDispatch = pgTable(
  "trip_dispatch",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .references(() => trip.id, { onDelete: "cascade" })
      .notNull(),
    status: tripDispatchStatusEnum("status").default("pending").notNull(),
    deadlineAt: timestamp("deadline_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("trip_dispatch_trip_id_unique_idx").on(table.tripId),
    index("trip_dispatch_status_deadline_idx").on(
      table.status,
      table.deadlineAt,
    ),
  ],
);

export const driverDispatchAttempt = pgTable(
  "driver_dispatch_attempt",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dispatchId: uuid("dispatch_id")
      .references(() => tripDispatch.id, { onDelete: "cascade" })
      .notNull(),
    driverId: uuid("driver_id")
      .references(() => driver.id, { onDelete: "restrict" })
      .notNull(),
    clientRequestId: uuid("client_request_id").notNull(),
    status: driverDispatchAttemptStatusEnum("status")
      .default("dialing")
      .notNull(),
    retryNumber: integer("retry_number").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("driver_dispatch_attempt_client_request_unique_idx").on(
      table.clientRequestId,
    ),
    uniqueIndex("driver_dispatch_attempt_active_dispatch_unique_idx")
      .on(table.dispatchId)
      .where(sql`status IN ('dialing', 'awaiting_dtmf')`),
    uniqueIndex("driver_dispatch_attempt_active_driver_unique_idx")
      .on(table.driverId)
      .where(sql`status IN ('dialing', 'awaiting_dtmf')`),
  ],
);

export const dispatchSchema = {
  tripDispatch,
  driverDispatchAttempt,
};

export type TripDispatchRecord = typeof tripDispatch.$inferSelect;
export type DriverDispatchAttemptRecord =
  typeof driverDispatchAttempt.$inferSelect;