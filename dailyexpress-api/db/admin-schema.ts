import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const adminAuditLog = pgTable("admin_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  adminEmail: text("admin_email").notNull(),
  target: text("target"),
  details: text("details"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const adminSchema = {
  adminAuditLog,
};

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type AdminAuditLogRecord = AdminAuditLog;
