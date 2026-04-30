import { pgTable, uuid, varchar, integer, text, jsonb, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const paymentProvider = pgEnum("payment_provider", ['opay'])
export const paymentStatus = pgEnum("payment_status", ['initialized', 'pending', 'successful', 'failed', 'cancelled', 'expired'])


export const payment = pgTable("payment", {
	id: uuid().notNull(),
	userId: uuid("user_id").notNull(),
	bookingId: uuid("booking_id"),
	provider: paymentProvider().notNull(),
	reference: varchar({ length: 128 }).notNull(),
	providerOrderNo: varchar("provider_order_no", { length: 128 }),
	amount: integer("amount").notNull(),
	currency: varchar({ length: 8 }).notNull(),
	country: varchar({ length: 2 }).notNull(),
	payMethod: varchar("pay_method", { length: 32 }),
	productName: text("product_name").notNull(),
	productDescription: text("product_description").notNull(),
	customerName: text("customer_name"),
	customerEmail: text("customer_email"),
	customerMobile: text("customer_mobile"),
	status: paymentStatus().notNull(),
	providerStatus: varchar("provider_status", { length: 32 }),
	cashierUrl: text("cashier_url"),
	callbackUrl: text("callback_url").notNull(),
	returnUrl: text("return_url").notNull(),
	cancelUrl: text("cancel_url"),
	expireAtMinutes: integer("expire_at_minutes").notNull(),
	rawCreateResponse: jsonb("raw_create_response"),
	rawStatusResponse: jsonb("raw_status_response"),
	metadata: jsonb(),
	lastStatusCheckAt: timestamp("last_status_check_at", { mode: 'string' }),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	failedAt: timestamp("failed_at", { mode: 'string' }),
	failureCode: text("failure_code"),
	failureReason: text("failure_reason"),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
});

export const paymentWebhook = pgTable("payment_webhook", {
	id: uuid().notNull(),
	provider: paymentProvider().notNull(),
	paymentReference: varchar("payment_reference", { length: 128 }),
	eventType: varchar("event_type", { length: 64 }),
	signatureValid: boolean("signature_valid").notNull(),
	payload: jsonb().notNull(),
	verificationNote: text("verification_note"),
	processedAt: timestamp("processed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
});
