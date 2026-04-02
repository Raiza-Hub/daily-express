import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const paymentProviderEnum = pgEnum("payment_provider", ["paystack"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "initialized",
  "pending",
  "successful",
  "failed",
  "cancelled",
  "expired",
]);

export const payment = pgTable("payment", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  bookingId: uuid("booking_id"),
  provider: paymentProviderEnum("provider").default("paystack").notNull(),
  reference: varchar("reference", { length: 128 }).notNull().unique(),
  providerTransactionId: varchar("provider_transaction_id", { length: 128 }),
  amountMinor: integer("amount_minor").notNull(),
  currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
  productName: text("product_name").notNull(),
  productDescription: text("product_description").notNull(),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerMobile: text("customer_mobile"),
  status: paymentStatusEnum("status").default("initialized").notNull(),
  providerStatus: varchar("provider_status", { length: 32 }),
  checkoutUrl: text("checkout_url"),
  checkoutToken: text("checkout_token"),
  redirectUrl: text("redirect_url").notNull(),
  cancelUrl: text("cancel_url"),
  channels: jsonb("channels"),
  rawInitializeResponse: jsonb("raw_initialize_response"),
  rawVerificationResponse: jsonb("raw_verification_response"),
  metadata: jsonb("metadata"),
  lastStatusCheckAt: timestamp("last_status_check_at"),
  paidAt: timestamp("paid_at"),
  failedAt: timestamp("failed_at"),
  failureCode: text("failure_code"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const paymentWebhook = pgTable("payment_webhook", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: paymentProviderEnum("provider").default("paystack").notNull(),
  paymentReference: varchar("payment_reference", { length: 128 }),
  eventType: varchar("event_type", { length: 64 }).default("paystack.event"),
  signatureValid: boolean("signature_valid").default(false).notNull(),
  payload: jsonb("payload").notNull(),
  verificationNote: text("verification_note"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const schema = {
  payment,
  paymentWebhook,
};
