import { isIP } from "node:net";
import type { Request } from "express";

export function getHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function normalizeIp(value: string | undefined): string | undefined {
  const ip = value?.split(",")[0]?.trim();
  return ip && isIP(ip) ? ip : undefined;
}

export function getClientIp(req: Request): string {
  return (
    normalizeIp(getHeaderValue(req.headers["cf-connecting-ip"])) ??
    normalizeIp(getHeaderValue(req.headers["x-real-ip"])) ??
    normalizeIp(req.ip) ??
    normalizeIp(req.socket.remoteAddress) ??
    "unknown"
  );
}
