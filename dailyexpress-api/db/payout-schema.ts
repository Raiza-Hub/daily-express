import { relations } from "drizzle-orm";
import {
  bigint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { driver } from "./driver-schema";
import { trip } from "./route-schema";

export const payoutProviderEnum = pgEnum("payout_provider", ["kora"]);
export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "successful",
  "failed",
]);

export const earning = pgTable(
  "earning",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // No driver_id: the driver is derived from trip.driverId, which dispatch
    // assigns write-once before the trip completes. Keeping a copy here meant
    // every write path had to remember to populate it.
    tripId: uuid("trip_id")
      .references(() => trip.id, { onDelete: "restrict" })
      .notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    payoutId: uuid("payout_id").references(() => payout.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("earning_trip_unique_idx").on(table.tripId)],
);

export const payout = pgTable("payout", {
  id: uuid("id").defaultRandom().primaryKey(),
  driverId: uuid("driver_id")
    .references(() => driver.id, { onDelete: "restrict" })
    .notNull(),
  tripId: uuid("trip_id").references(() => trip.id, { onDelete: "restrict" }),
  recipientBankName: text("recipient_bank_name"),
  recipientAccountLast4: varchar("recipient_account_last4", { length: 4 }),
  reference: varchar("reference", { length: 128 }).notNull().unique(),
  provider: payoutProviderEnum("provider").default("kora").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
  status: payoutStatusEnum("status").default("pending").notNull(),
  driverEmail: varchar("driver_email", { length: 255 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const earningRelations = relations(earning, ({ one }) => ({
  trip: one(trip, {
    fields: [earning.tripId],
    references: [trip.id],
  }),
}));

export const payoutSchema = {
  earning,
  payout,
  earningRelations,
};

export type Earning = typeof earning.$inferSelect;
export type EarningRecord = Earning;
export type Payout = typeof payout.$inferSelect;
export type PayoutRecord = Payout;
