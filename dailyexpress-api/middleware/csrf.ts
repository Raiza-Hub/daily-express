import { doubleCsrf } from "csrf-csrf";
import type { Request } from "express";
import { getConfig } from "../config";

const config = getConfig();

export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => config.CSRF_SECRET,
  getSessionIdentifier: (req: Request) => req.ip ?? "anonymous",
  cookieName: "psifi.x-csrf-token",
  cookieOptions: {
    sameSite: "lax",
    path: "/",
    secure: config.NODE_ENV === "production",
    httpOnly: false,
    ...(config.COOKIE_DOMAIN && config.NODE_ENV === "production" ? { domain: config.COOKIE_DOMAIN } : {}),
  },
  size: 64,
  getCsrfTokenFromRequest: (req) =>
    req.headers["x-csrf-token"] as string | undefined,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  skipCsrfProtection: (req: Request) => {
    if (req.path.includes("/webhooks/")) return true;
    if (req.path.startsWith("/api/v1/auth/")) return true;
    if (req.path.startsWith("/api/v1/admin/")) return true;
    if (req.path === "/health" || req.path === "/health/ready") return true;
    return false;
  },
});
