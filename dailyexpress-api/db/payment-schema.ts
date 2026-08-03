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
import { users } from "./auth-schema";
import { booking } from "./route-schema";

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
    reference: varchar("reference", { length: 128 }).notNull().unique(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    productName: text("product_name").notNull(),
    customerEmail: text("customer_email"),
    status: paymentStatusEnum("status").default("pending").notNull(),
    payerBankName: text("payer_bank_name"),
    payerAccountNumber: varchar("payer_account_number", { length: 32 }),
    payerAccountName: text("payer_account_name"),
    checkoutUrl: text("checkout_url"),
    failedAt: timestamp("failed_at", { mode: "date" }),
    failureCode: text("failure_code"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payment_booking_id_unique_idx").on(table.bookingId),
  ],
);

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
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    reason: text("reason"),
    status: refundStatusEnum("status").default("pending").notNull(),
    failureReason: text("failure_reason"),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
);

export const paymentSchema = {
  payment,
  refund,
};

export type Payment = typeof payment.$inferSelect;
export type PaymentRecord = Payment;
export type Refund = typeof refund.$inferSelect;
export type RefundRecord = Refund;

