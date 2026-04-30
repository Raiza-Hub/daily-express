import type { Request } from "express";
import type { HttpMethod } from "../types/index.js";

export interface PublicPath {
  pattern: RegExp;
  methods: readonly HttpMethod[];
  description: string;
  group: "auth" | "route" | "payment" | "payout" | "system";
}

export const PUBLIC_PATHS: readonly PublicPath[] = [
  {
    pattern: /^(?:\/api\/auth)?\/v1\/auth\/register$/,
    methods: ["POST"],
    description: "User registration",
    group: "auth",
  },
  {
    pattern: /^(?:\/api\/auth)?\/v1\/auth\/login$/,
    methods: ["POST"],
    description: "User login",
    group: "auth",
  },
  {
    pattern: /^(?:\/api\/auth)?\/v1\/auth\/google$/,
    methods: ["GET"],
    description: "Google OAuth initiation",
    group: "auth",
  },
  {
    pattern: /^(?:\/api\/auth)?\/v1\/auth\/google\/callback$/,
    methods: ["GET"],
    description: "Google OAuth callback",
    group: "auth",
  },
  {
    pattern: /^(?:\/api\/auth)?\/v1\/auth\/forget-password$/,
    methods: ["POST"],
    description: "Password reset request",
    group: "auth",
  },
  {
    pattern: /^(?:\/api\/auth)?\/v1\/auth\/reset-password\/[^/]+$/,
    methods: ["POST"],
    description: "Password reset with token",
    group: "auth",
  },
  {
    pattern: /^(?:\/api\/routes)?\/v1\/route\/search$/,
    methods: ["GET"],
    description: "Search routes by criteria",
    group: "route",
  },
  {
    pattern: /^(?:\/api\/routes)?\/v1\/route\/get\/[^/]+$/,
    methods: ["GET"],
    description: "View specific route details",
    group: "route",
  },
  {
    pattern: /^(?:\/api\/payments)?\/v1\/payments\/webhooks\/kora$/,
    methods: ["POST"],
    description: "Kora payment webhook",
    group: "payment",
  },
  {
    pattern: /^(?:\/api\/payments)?\/v1\/payments\/return$/,
    methods: ["GET"],
    description: "Hosted checkout return",
    group: "payment",
  },
  {
    pattern: /^(?:\/api\/payouts)?\/v1\/payouts\/webhooks\/kora$/,
    methods: ["POST"],
    description: "Kora payout webhook",
    group: "payout",
  },
  {
    pattern: /^\/health$/,
    methods: ["GET"],
    description: "Health check",
    group: "system",
  },
] as const;

function getPathname(urlOrPath: string): string {
  return urlOrPath.split("?")[0] || "/";
}

function matchesPublicPath(
  path: string,
  method: string,
  group?: PublicPath["group"],
): boolean {
  const pathname = getPathname(path);

  return PUBLIC_PATHS.some((publicPath) => {
    if (group && publicPath.group !== group) {
      return false;
    }

    return (
      publicPath.methods.includes(method as HttpMethod) &&
      publicPath.pattern.test(pathname)
    );
  });
}

export function getRequestPath(req: Request): string {
  return getPathname(req.originalUrl || req.url || req.path);
}

export function isPublicPath(path: string, method: string): boolean {
  return matchesPublicPath(path, method);
}

export function isPublicAuthPath(path: string, method: string): boolean {
  return matchesPublicPath(path, method, "auth");
}

export function isPublicRouteSearchPath(path: string, method: string): boolean {
  return matchesPublicPath(path, method, "route");
}
