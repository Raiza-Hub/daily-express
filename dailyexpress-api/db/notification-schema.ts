import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { driver } from "./driver-schema";

export const notificationToneEnum = pgEnum("notification_tone", [
  "critical",
  "attention",
  "positive",
  "info",
]);

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id")
      .references(() => driver.id, { onDelete: "cascade" })
      .notNull(),
    notificationKey: varchar("notification_key", { length: 191 }).notNull(),
    type: varchar("type", { length: 96 }).notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    href: text("href"),
    tag: varchar("tag", { length: 64 }).notNull(),
    tone: notificationToneEnum("tone").default("info").notNull(),
    contentHash: varchar("content_hash", { length: 128 }).notNull(),
    readAt: timestamp("read_at", { mode: "date" }),
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
  ],
);

export type Notification = typeof notification.$inferSelect;
export type NotificationRecord = Notification;
