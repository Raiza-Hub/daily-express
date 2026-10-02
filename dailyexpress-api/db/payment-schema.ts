import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema";
import { booking } from "./route-schema";

export const transactionStatusEnum = pgEnum("transaction_status", [
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
    status: transactionStatusEnum("status").default("pending").notNull(),
    refundId: uuid("refund_id").references((): AnyPgColumn => refund.id, { onDelete: "set null" }),
    payerBankName: text("payer_bank_name"),
    payerAccountNumber: varchar("payer_account_number", { length: 32 }),
    payerAccountName: text("payer_account_name"),
    checkoutUrl: text("checkout_url"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payment_booking_id_unique_idx").on(table.bookingId),
    uniqueIndex("payment_refund_id_unique_idx").on(table.refundId),
  ],
);

export const refund = pgTable(
  "refund",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .references(() => payment.id, { onDelete: "restrict" })
      .notNull(),
    reference: varchar("reference", { length: 128 }).notNull().unique(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 8 }).default("NGN").notNull(),
    status: transactionStatusEnum("status").default("pending").notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("refund_payment_id_idx").on(table.paymentId),
    uniqueIndex("refund_payment_pending_unique_idx")
      .on(table.paymentId)
      .where(sql`status = 'pending'`),
  ],
);

export const paymentSchema = {
  payment,
  refund,
};

export type PaymentRecord = typeof payment.$inferSelect;
export type RefundRecord = typeof refund.$inferSelect;
export type TransactionStatus = typeof transactionStatusEnum.enumValues[number];
