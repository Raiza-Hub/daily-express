import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const bankVerificationStatusEnum = pgEnum("bank_verification_status", [
  "pending",
  "active",
  "failed",
]);

export const driver = pgTable("driver", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  profile_pic: text("profile_picture"),
  phone: text("phone").notNull(),
  country: text("country").notNull(),
  currency: text("currency").notNull(),
  state: text("state").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  bankName: text("bank_name").notNull(),
  bankCode: text("bank_code").notNull(),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  bankVerificationStatus: bankVerificationStatusEnum("bank_verification_status")
    .default("pending")
    .notNull(),
  bankVerificationFailureReason: text("bank_verification_failure_reason"),
  bankVerificationRequestedAt: timestamp("bank_verification_requested_at", {
    mode: "date",
  }),
  bankVerifiedAt: timestamp("bank_verified_at", { mode: "date" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const driverStats = pgTable("driver_stats", {
  id: uuid("id").defaultRandom().primaryKey(),
  driverId: uuid("driver_id")
    .references(() => driver.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  totalEarnings: integer("total_earnings").default(0).notNull(),
  pendingPayments: integer("pending_payments").default(0).notNull(),
  totalPassengers: integer("total_passengers").default(0).notNull(),
  activeRoutes: integer("active_routes").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const driverRelations = relations(driver, ({ one }) => ({
  stats: one(driverStats, {
    relationName: "driver_stats",
    fields: [driver.id],
    references: [driverStats.driverId],
  }),
}));

export const driverStatsRelations = relations(driverStats, ({ one }) => ({
  driver: one(driver, {
    relationName: "driver_stats",
    fields: [driverStats.driverId],
    references: [driver.id],
  }),
}));

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

export const schema = {
  driver,
  driverStats,
  outboxEvents,
};

export type OutboxEvent = typeof outboxEvents.$inferSelect;
