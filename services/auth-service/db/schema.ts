import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password"),
  // phone: text("phone").notNull(),
  dateOfBirth: timestamp("date_of_birth").notNull(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  referal: text("referal"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const otp = pgTable("otp", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  otp: text("otp").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userProviders = pgTable("user_providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  provider: text("provider").notNull(),
  providerId: text("provider_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const outboxEvents = pgTable("outbox_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventType: text("event_type").notNull(),
  topic: text("topic").notNull(),
  partitionKey: text("partition_key").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Otp = typeof otp.$inferSelect;
export type UserProvider = typeof userProviders.$inferSelect;
export type OutboxEvent = typeof outboxEvents.$inferSelect;

export const schema = {
  users,
  otp,
  userProviders,
  outboxEvents,
};
