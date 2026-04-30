import {
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
import { sql } from "drizzle-orm";

export const notificationToneEnum = pgEnum("notification_tone", [
  "critical",
  "attention",
  "positive",
  "info",
]);

export const notificationKindEnum = pgEnum("notification_kind", [
  "event",
  "state",
]);

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    driverId: uuid("driver_id").notNull(),

    notificationKey: varchar("notification_key", { length: 191 }).notNull(),

    kind: notificationKindEnum("kind").default("event").notNull(),

    type: varchar("type", { length: 96 }).notNull(),

    title: text("title").notNull(),

    message: text("message").notNull(),

    href: text("href"),

    tag: varchar("tag", { length: 64 }).notNull(),

    tone: notificationToneEnum("tone").default("info").notNull(),

    metadata: jsonb("metadata"),

    contentHash: varchar("content_hash", { length: 128 }).notNull(),

    readAt: timestamp("read_at", { mode: "date" }),

    occurredAt: timestamp("occurred_at", { mode: "date" })
      .defaultNow()
      .notNull(),

    archivedAt: timestamp("archived_at", { mode: "date" }),

    createdAt: timestamp("created_at", { mode: "date" })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("notification_driver_key_unique").on(
      table.driverId,
      table.notificationKey,
    ),

    index("notification_driver_active_cursor_idx")
      .on(table.driverId.asc(), table.occurredAt.desc(), table.createdAt.desc())
      .where(sql`archived_at IS NULL`),

    index("notification_driver_unread_active_idx")
      .on(table.driverId.asc(), table.occurredAt.desc(), table.createdAt.desc())
      .where(sql`archived_at IS NULL AND read_at IS NULL`),
  ],
);

export const driverIdentity = pgTable(
  "driver_identity",
  {
    driverId: uuid("driver_id").primaryKey(),
    userId: uuid("user_id").notNull().unique(),
    sourceOccurredAt: timestamp("source_occurred_at", { mode: "date" })
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("driver_identity_user_id_idx").on(table.userId),
    index("driver_identity_source_occurred_at_idx").on(table.sourceOccurredAt),
  ],
);

export const consumedEvent = pgTable(
  "consumed_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: varchar("event_id", { length: 128 }).notNull().unique(),
    topic: varchar("topic", { length: 128 }).notNull(),
    processedAt: timestamp("processed_at", { mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("consumed_event_topic_processed_at_idx").on(
      table.topic,
      table.processedAt.desc(),
    ),
  ],
);

export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    driverId: uuid("driver_id").notNull(),

    endpoint: text("endpoint").notNull(),

    p256dh: text("p256dh").notNull(),

    auth: text("auth").notNull(),

    createdAt: timestamp("created_at", { mode: "date" })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("push_subscription_driver_endpoint_unique").on(
      table.driverId,
      table.endpoint,
    ),
    index("push_subscription_driver_idx").on(table.driverId),
  ],
);

export const schema = {
  driverIdentity,
  notification,
  consumedEvent,
  pushSubscription,
};
