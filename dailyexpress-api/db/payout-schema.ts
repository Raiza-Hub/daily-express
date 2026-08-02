import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { driver } from "./driver-schema";
import { booking, trip, route } from "./route-schema";

export const earningStatusEnum = pgEnum("earning_status", [
  "pending_trip_completion",
  "available",
  "processing",
  "paid",
  "cancelled",
]);

export const payoutProviderEnum = pgEnum("payout_provider", ["kora"]);
export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "processing",
  "success",
  "failed",
]);

export const earning = pgTable(
  "earning",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id").references(() => driver.id, { onDelete: "restrict" }).notNull(),
    bookingId: uuid("booking_id").references(() => booking.id, { onDelete: "restrict" }).notNull().unique(),
    tripId: uuid("trip_id").references(() => trip.id, { onDelete: "restrict" }).notNull(),
    routeId: uuid("route_id").references(() => route.id, { onDelete: "restrict" }).notNull(),
    tripDate: timestamp("trip_date", { mode: "date" }).notNull(),
    pickupTitle: text("pickup_title").notNull(),
    dropoffTitle: text("dropoff_title").notNull(),
    grossAmount: bigint("gross_amount", {
      mode: "number",
    }).notNull(),
    feeAmount: bigint("fee_amount", { mode: "number" }).notNull(),
    netAmount: bigint("net_amount", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    status: earningStatusEnum("status")
      .default("pending_trip_completion")
      .notNull(),
    sourceEventId: varchar("source_event_id", { length: 128 })
      .notNull()
      .unique(),
    payoutId: uuid("payout_id"),
    availableAt: timestamp("available_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("earning_driver_id_idx").on(table.driverId),
    index("earning_trip_id_idx").on(table.tripId),
    index("earning_route_id_idx").on(table.routeId),
    index("earning_status_idx").on(table.status),
    index("earning_driver_status_idx").on(table.driverId, table.status),
    index("earning_trip_status_idx").on(table.tripId, table.status),
  ],
);

export const payout = pgTable(
  "payout",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id").references(() => driver.id, { onDelete: "restrict" }).notNull(),
    tripId: uuid("trip_id").references(() => trip.id, { onDelete: "restrict" }),
    recipientBankName: text("recipient_bank_name"),
    recipientAccountLast4: varchar("recipient_account_last4", { length: 4 }),
    reference: varchar("reference", { length: 128 }).notNull().unique(),
    provider: payoutProviderEnum("provider").default("kora").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    status: payoutStatusEnum("status").default("processing").notNull(),
    driverEmail: varchar("driver_email", { length: 255 }),
    failureCode: text("failure_code"),
    failureReason: text("failure_reason"),
    initiatedAt: timestamp("initiated_at", { mode: "date" }),
    settledAt: timestamp("settled_at", { mode: "date" }),
    failedAt: timestamp("failed_at", { mode: "date" }),
    rawInitiateResponse: jsonb("raw_initiate_response"),
    rawFinalStatusResponse: jsonb("raw_final_status_response"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("payout_driver_id_idx").on(table.driverId),
    index("payout_status_idx").on(table.status),
    index("payout_driver_created_at_idx").on(
      table.driverId,
      table.createdAt.desc(),
    ),
    index("payout_driver_status_created_at_idx").on(
      table.driverId,
      table.status,
      table.createdAt.desc(),
    ),
    index("payout_driver_status_settled_at_idx").on(
      table.driverId,
      table.status,
      table.settledAt.desc(),
    ),
  ],
);

export const payoutSchema = {
  earning,
  payout,
};

export type Earning = typeof earning.$inferSelect;
export type EarningRecord = Earning;
export type Payout = typeof payout.$inferSelect;
export type PayoutRecord = Payout;
