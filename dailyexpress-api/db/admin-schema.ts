import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const adminAuditLog = pgTable("admin_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  adminEmail: text("admin_email").notNull(),
  target: text("target"),
  details: text("details"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  index("admin_audit_log_created_at_idx").on(table.createdAt),
  index("admin_audit_log_admin_email_idx").on(table.adminEmail),
]);

export const adminSchema = {
  adminAuditLog,
};

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type AdminAuditLogRecord = AdminAuditLog;
