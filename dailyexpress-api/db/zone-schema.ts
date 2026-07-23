import { relations } from "drizzle-orm";
import {
  pgTable,
  timestamp,
  uuid,
  text,
  bigint,
} from "drizzle-orm/pg-core";
import { route } from "./route-schema";

export const zone = pgTable("zone", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  fee: bigint("fee", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const zoneRelations = relations(zone, ({ many }) => ({
  routes: many(route),
}));

export type ZoneRecord = typeof zone.$inferSelect;

export const zoneSchema = { zone };
