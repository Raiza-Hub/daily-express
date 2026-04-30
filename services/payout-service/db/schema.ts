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

export const earningStatusEnum = pgEnum("earning_status", [
  "pending_trip_completion",
  "available",
  "reserved",
  "processing",
  "paid",
  "cancelled",
  "manual_review",
]);

export const payoutProviderEnum = pgEnum("payout_provider", ["kora"]);
export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "processing",
  "success",
  "failed",
  "permanent_failed",
]);

export const payoutRecipientStatusEnum = pgEnum("payout_recipient_status", [
  "active",
  "stale",
  "failed",
]);

export const driverPayoutProfile = pgTable(
  "driver_payout_profile",
  {
    driverId: uuid("driver_id").primaryKey(),
    userId: uuid("user_id"),
    email: varchar("email", { length: 255 }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    phone: text("phone"),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    bankName: text("bank_name"),
    bankCode: varchar("bank_code", { length: 32 }),
    accountNumber: text("account_number"),
    accountName: text("account_name"),
    bankVerificationStatus: varchar("bank_verification_status", {
      length: 32,
    }),
    bankVerificationFailureReason: text("bank_verification_failure_reason"),
    sourceUpdatedAt: timestamp("source_updated_at", { mode: "date" }),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("driver_payout_profile_user_id_idx").on(table.userId),
    index("driver_payout_profile_active_idx").on(table.isActive),
  ],
);

export const earning = pgTable(
  "earning",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id").notNull(),
    bookingId: uuid("booking_id").notNull().unique(),
    tripId: uuid("trip_id").notNull(),
    routeId: uuid("route_id").notNull(),
    tripDate: timestamp("trip_date", { mode: "date" }).notNull(),
    pickupTitle: text("pickup_title").notNull(),
    dropoffTitle: text("dropoff_title").notNull(),
    grossAmountMinor: integer("gross_amount_minor").notNull(),
    feeAmountMinor: integer("fee_amount_minor").notNull(),
    netAmountMinor: integer("net_amount_minor").notNull(),
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

export const payoutRecipient = pgTable(
  "payout_recipient",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id").notNull().unique(),
    provider: payoutProviderEnum("provider").default("kora").notNull(),
    recipientCode: varchar("recipient_code", { length: 128 }).notNull(),
    providerRecipientId: varchar("provider_recipient_id", { length: 128 }),
    bankCode: varchar("bank_code", { length: 32 }).notNull(),
    bankName: text("bank_name").notNull(),
    accountName: text("account_name").notNull(),
    accountNumberLast4: varchar("account_number_last4", {
      length: 4,
    }).notNull(),
    detailsFingerprint: varchar("details_fingerprint", {
      length: 128,
    }).notNull(),
    status: payoutRecipientStatusEnum("status").default("active").notNull(),
    rawResponse: jsonb("raw_response"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("payout_recipient_driver_id_idx").on(table.driverId)],
);

export const payout = pgTable(
  "payout",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id").notNull(),
    earningId: uuid("earning_id"),
    recipientId: uuid("recipient_id").notNull(),
    reference: varchar("reference", { length: 128 }).notNull().unique(),
    provider: payoutProviderEnum("provider").default("kora").notNull(),
    providerTransferCode: varchar("provider_transfer_code", { length: 128 }),
    providerTransferId: varchar("provider_transfer_id", { length: 128 }),
    amountMinor: integer("amount_minor").notNull(),
    koraFeeAmount: integer("kora_fee_amount"),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    earningsCount: integer("earnings_count").notNull(),
    status: payoutStatusEnum("status").default("processing").notNull(),
    driverEmail: varchar("driver_email", { length: 255 }),
    failureCode: text("failure_code"),
    failureReason: text("failure_reason"),
    retryCount: integer("retry_count").default(0).notNull(),
    nextRetryAt: timestamp("next_retry_at", { mode: "date" }),
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
    index("payout_earning_id_idx").on(table.earningId),
    uniqueIndex("payout_earning_id_unique_idx").on(table.earningId),
    index("payout_status_idx").on(table.status),
    index("payout_driver_created_at_idx").on(
      table.driverId,
      table.createdAt.desc(),
    ),
    index("payout_status_retry_idx").on(table.status, table.nextRetryAt),
  ],
);

export const payoutWebhook = pgTable(
  "payout_webhook",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    reference: varchar("reference", { length: 128 }),
    signatureValid: boolean("signature_valid").default(false).notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("payout_webhook_reference_idx").on(table.reference),
    index("payout_webhook_created_at_idx").on(table.createdAt),
  ],
);

export const payoutAttempt = pgTable(
  "payout_attempt",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payoutId: uuid("payout_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    koraReference: varchar("kora_reference", { length: 128 })
      .notNull()
      .unique(),
    status: varchar("status", { length: 32 }).default("pending").notNull(),
    failureReason: text("failure_reason"),
    koraFeeAmount: integer("kora_fee_amount"),
    initiatedAt: timestamp("initiated_at", { mode: "date" })
      .defaultNow()
      .notNull(),
    settledAt: timestamp("settled_at", { mode: "date" }),
    rawWebhook: jsonb("raw_webhook"),
  },
  (table) => [
    index("payout_attempt_reference_idx").on(table.koraReference),
    index("payout_attempt_payout_id_idx").on(table.payoutId),
    uniqueIndex("payout_attempt_number_unique_idx").on(
      table.payoutId,
      table.attemptNumber,
    ),
  ],
);

export const consumedEvent = pgTable("consumed_event", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: varchar("event_id", { length: 128 }).notNull().unique(),
  topic: varchar("topic", { length: 128 }).notNull(),
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
    index("outbox_published_idx").on(table.publishedAt),
  ],
);

export const schema = {
  driverPayoutProfile,
  earning,
  payout,
  payoutAttempt,
  payoutRecipient,
  payoutWebhook,
  consumedEvent,
  outboxEvents,
};

export type OutboxEvent = typeof outboxEvents.$inferSelect;
