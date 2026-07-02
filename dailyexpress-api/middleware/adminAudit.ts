import { db } from "../db/connection";
import { adminAuditLog } from "../db/index";
import { logger } from "../utils/logger";

export interface AdminAuditInput {
  action: string;
  adminEmail: string;
  target?: string;
  ip?: string;
  details?: string;
}

export async function recordAdminAudit(input: AdminAuditInput) {
  logger.info("admin.audit", {
    action: input.action,
    adminEmail: input.adminEmail,
    target: input.target,
    ip: input.ip,
    details: input.details,
  });

  await db.insert(adminAuditLog).values({
    action: input.action,
    adminEmail: input.adminEmail,
    target: input.target ?? null,
    ip: input.ip ?? null,
    details: input.details ?? null,
  });
}
