import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { sendErrorResponse } from "./apiResponses";
import { loadConfig } from "../config";

export interface AdminUser {
  email: string;
}

export function requireAdminApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const config = loadConfig();
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendErrorResponse(res, 401, "Admin API key required.", {
      code: "ADMIN_API_KEY_REQUIRED",
    });
    return;
  }

  const apiKey = authHeader.slice("Bearer ".length);
  const expectedKey = config.ADMIN_API_KEY;
  if (
    apiKey.length !== expectedKey.length ||
    !timingSafeEqual(Buffer.from(apiKey), Buffer.from(expectedKey))
  ) {
    sendErrorResponse(res, 403, "Invalid admin API key.", {
      code: "INVALID_ADMIN_API_KEY",
    });
    return;
  }

  const adminEmail = req.headers["x-admin-email"];
  if (typeof adminEmail !== "string" || !adminEmail.trim()) {
    sendErrorResponse(res, 400, "X-Admin-Email header is required.", {
      code: "ADMIN_EMAIL_REQUIRED",
    });
    return;
  }

  req.adminUser = { email: adminEmail.trim() };
  next();
}
