import {
  bigint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { driver } from "./driver-schema";
import { booking, trip } from "./route-schema";

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
        amount: bigint("amount", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    status: earningStatusEnum("status")
      .default("pending_trip_completion")
      .notNull(),
    payoutId: uuid("payout_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
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
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
);

export const payoutSchema = {
  earning,
  payout,
};

export type Earning = typeof earning.$inferSelect;
export type EarningRecord = Earning;
export type Payout = typeof payout.$inferSelect;
export type PayoutRecord = Payout;
