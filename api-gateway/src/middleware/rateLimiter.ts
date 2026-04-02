import rateLimit from "express-rate-limit";
import { getConfig } from "../config/index.js";
import { isPublicAuthPath, isPublicRouteSearchPath } from "./publicPaths.js";
import type { Request } from "express";

const config = getConfig();

export const publicAuthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.RATE_LIMIT_PUBLIC_AUTH,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again after a minute.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    return !isPublicAuthPath(req.path, req.method);
  },
});

export const publicRoutesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.RATE_LIMIT_PUBLIC_ROUTES,
  message: {
    success: false,
    message:
      "Too many requests from this IP for route search. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    return !isPublicRouteSearchPath(req.path, req.method);
  },
});

export const protectedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.RATE_LIMIT_PROTECTED,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    return isPublicPath(req.path, req.method);
  },
});

function isPublicPath(path: string, method: string): boolean {
  return (
    isPublicAuthPath(path, method) || isPublicRouteSearchPath(path, method)
  );
}
