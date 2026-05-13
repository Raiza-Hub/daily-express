import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Redis } from "@upstash/redis";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { getConfig } from "../config/index";
import type { Request } from "express";
import {
  getRequestPath,
  isPublicAuthPath,
  isPublicPath,
  isPublicRouteSearchPath,
  isWebhookPath,
} from "./publicPaths";

const config = getConfig();
const hasUpstashCredentials = Boolean(
  config.RATE_LIMIT_UPSTASH_REDIS_REST_URL &&
    config.RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN,
);

if (config.NODE_ENV === "production" && !hasUpstashCredentials) {
  throw new Error(
    "Redis-backed rate limiting requires RATE_LIMIT_UPSTASH_REDIS_REST_URL and RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN.",
  );
}

const redis =
  config.RATE_LIMIT_UPSTASH_REDIS_REST_URL &&
  config.RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: config.RATE_LIMIT_UPSTASH_REDIS_REST_URL,
        token: config.RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

function getClientKey(req: Request): string {
  return `ip:${ipKeyGenerator(req.ip as string)}`;
}

function createLimiter(options: {
  windowMs: number;
  max: number;
  prefix: string;
  message: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: redis
      ? new RedisStore({
          sendCommand: (...args: string[]) =>
            redis.exec(args as [string, ...string[]]) as Promise<RedisReply>,
          prefix: `rl:${options.prefix}:`,
        })
      : undefined,
    keyGenerator: options.keyGenerator ?? getClientKey,
    message: {
      success: false,
      message: options.message,
    },
    skip: options.skip,
  });
}

export const publicRoutesLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PUBLIC_ROUTES ?? 120),
  prefix: "public",
  message: "Too many requests. Please try again shortly.",
  skip: (req) => !isPublicRouteSearchPath(getRequestPath(req), req.method),
});

export const authLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PUBLIC_AUTH ?? 10),
  prefix: "auth",
  message: "Too many authentication attempts. Please try again shortly.",
  skip: (req) => !isPublicAuthPath(getRequestPath(req), req.method),
});

export const protectedLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PROTECTED ?? 180),
  prefix: "protected",
  message: "Too many requests. Please slow down.",
  skip: (req) => isPublicPath(getRequestPath(req), req.method),
});

// export const bookingLimiter = createLimiter({
//   windowMs: 60 * 1000,
//   max: Number(process.env.RATE_LIMIT_BOOKING ?? 10),
//   prefix: "booking",
//   message: "Too many booking attempts. Please try again shortly.",
// });

export const webhookLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_WEBHOOK ?? 300),
  prefix: "webhook",
  message: "Too many webhook requests.",
  skip: (req) => !isWebhookPath(getRequestPath(req), req.method),
});
