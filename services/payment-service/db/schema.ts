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

export const paymentProviderEnum = pgEnum("payment_provider", ["kora"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "initialized",
  "pending",
  "successful",
  "failed",
  "cancelled",
  "expired",
  "refund_pending",
  "refunded",
  "refund_failed",
]);

export const payment = pgTable(
  "payment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    bookingId: uuid("booking_id"),
    provider: paymentProviderEnum("provider").default("kora").notNull(),
    reference: varchar("reference", { length: 128 }).notNull().unique(),
    providerTransactionId: varchar("provider_transaction_id", { length: 128 }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    productName: text("product_name").notNull(),
    productDescription: text("product_description").notNull(),
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerMobile: text("customer_mobile"),
    status: paymentStatusEnum("status").default("pending").notNull(),
    providerStatus: varchar("provider_status", { length: 32 }),
    checkoutUrl: text("checkout_url"),
    checkoutToken: text("checkout_token"),
    redirectUrl: text("redirect_url").notNull(),
    cancelUrl: text("cancel_url"),
    channels: jsonb("channels"),
    rawInitializeResponse: jsonb("raw_initialize_response"),
    rawVerificationResponse: jsonb("raw_verification_response"),
    metadata: jsonb("metadata"),
    lastStatusCheckAt: timestamp("last_status_check_at", { mode: "date" }),
    paidAt: timestamp("paid_at", { mode: "date" }),
    failedAt: timestamp("failed_at", { mode: "date" }),
    failureCode: text("failure_code"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("payment_user_id_idx").on(table.userId),
    index("payment_booking_id_idx").on(table.bookingId),
    index("payment_status_idx").on(table.status),
    index("payment_created_at_idx").on(table.createdAt),
    index("payment_status_created_idx").on(table.status, table.createdAt),
    uniqueIndex("payment_booking_id_unique_idx").on(table.bookingId),
  ],
);

export const paymentWebhook = pgTable(
  "payment_webhook",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: paymentProviderEnum("provider").default("kora").notNull(),
    paymentReference: varchar("payment_reference", { length: 128 }),
    eventType: varchar("event_type", { length: 64 }).default("kora.event"),
    signatureValid: boolean("signature_valid").default(false).notNull(),
    payload: jsonb("payload").notNull(),
    verificationNote: text("verification_note"),
    processedAt: timestamp("processed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("payment_webhook_payment_reference_idx").on(table.paymentReference),
    index("payment_webhook_created_at_idx").on(table.createdAt),
  ],
);

export const webhookProcessed = pgTable("webhook_processed", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  eventReference: varchar("event_reference", { length: 128 })
    .notNull()
    .unique(),
  processedAt: timestamp("processed_at", { mode: "date" })
    .defaultNow()
    .notNull(),
});

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
    index("outbox_aggregate_event_idx").on(table.aggregateId, table.eventType),
    index("outbox_published_idx").on(table.publishedAt),
    index("outbox_event_id_idx").on(table.eventId),
  ],
);

export const bookingHold = pgTable(
  "booking_hold",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id").notNull().unique(),
    tripId: uuid("trip_id").notNull(),
    userId: uuid("user_id").notNull(),
    fareAmount: integer("fare_amount").notNull(),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    pgBossJobId: text("pg_boss_job_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("booking_hold_expires_at_idx").on(table.expiresAt),
    index("booking_hold_booking_id_idx").on(table.bookingId),
  ],
);

export const schema = {
  payment,
  paymentWebhook,
  webhookProcessed,
  outboxEvents,
  bookingHold,
};

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type BookingHold = typeof bookingHold.$inferSelect;
