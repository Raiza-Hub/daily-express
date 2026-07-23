import {
  bigint,
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema";
import { booking, trip } from "./route-schema";

export const paymentProviderEnum = pgEnum("payment_provider", ["kora"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "initialized",
  "pending",
  "processing",
  "successful",
  "failed",
  "cancelled",
  "expired",
  "refund_pending",
  "refunded",
  "refund_failed",
]);
export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "successful",
  "failed",
]);

export const payment = pgTable(
  "payment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
    bookingId: uuid("booking_id").references(() => booking.id, { onDelete: "set null" }),
    provider: paymentProviderEnum("provider").default("kora").notNull(),
    reference: varchar("reference", { length: 128 }).notNull().unique(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    productName: text("product_name").notNull(),
    customerEmail: text("customer_email"),
    status: paymentStatusEnum("status").default("pending").notNull(),
    providerStatus: varchar("provider_status", { length: 32 }),
    payerBankName: text("payer_bank_name"),
    payerAccountNumber: varchar("payer_account_number", { length: 32 }),
    payerAccountName: text("payer_account_name"),
    checkoutUrl: text("checkout_url"),
    channels: jsonb("channels"),
    rawInitializeResponse: jsonb("raw_initialize_response"),
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



export const refund = pgTable(
  "refund",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .references(() => payment.id, { onDelete: "restrict" })
      .notNull(),
    bookingId: uuid("booking_id").references(() => booking.id, {
      onDelete: "set null",
    }),
    reference: varchar("reference", { length: 128 }).notNull().unique(),
    providerRefundReference: varchar("provider_refund_reference", {
      length: 128,
    }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    reason: text("reason"),
    status: refundStatusEnum("status").default("pending").notNull(),
    providerStatus: varchar("provider_status", { length: 32 }),
    rawProviderResponse: jsonb("raw_provider_response"),
    failureReason: text("failure_reason"),
    initiatedBy: varchar("initiated_by", { length: 32 })
      .default("auto")
      .notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("refund_payment_id_idx").on(table.paymentId),
    index("refund_booking_id_idx").on(table.bookingId),
    index("refund_status_idx").on(table.status),
    index("refund_provider_ref_idx").on(table.providerRefundReference),
  ],
);

export const paymentSchema = {
  payment,
  paymentWebhook,
  webhookProcessed,
  refund,
};

export type Payment = typeof payment.$inferSelect;
export type PaymentRecord = Payment;
export type PaymentWebhook = typeof paymentWebhook.$inferSelect;
export type PaymentWebhookRecord = PaymentWebhook;
export type Refund = typeof refund.$inferSelect;
export type RefundRecord = Refund;
export type NewRefund = typeof refund.$inferInsert;
