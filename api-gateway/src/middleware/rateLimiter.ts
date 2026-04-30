import rateLimit from "express-rate-limit";
import { Redis } from "@upstash/redis";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { getConfig } from "../config/index.js";
import {
  getRequestPath,
  isPublicAuthPath,
  isPublicPath,
  isPublicRouteSearchPath,
} from "./publicPaths.js";
import type { Request } from "express";

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

function createRateLimitStore(prefix: string) {
  if (!redis) return undefined;

  return new RedisStore({
    sendCommand: (...args: string[]) =>
      redis.exec(args as [string, ...string[]]) as Promise<RedisReply>,
    prefix,
  });
}

export const publicAuthLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.RATE_LIMIT_PUBLIC_AUTH,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again after a minute.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: createRateLimitStore("rl:api-gateway:public-auth:"),
  skip: (req: Request) => {
    return !isPublicAuthPath(getRequestPath(req), req.method);
  },
});

export const publicRoutesLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.RATE_LIMIT_PUBLIC_ROUTES,
  message: {
    success: false,
    message:
      "Too many requests from this IP for route search. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: createRateLimitStore("rl:api-gateway:public-routes:"),
  skip: (req: Request) => {
    return !isPublicRouteSearchPath(getRequestPath(req), req.method);
  },
});

export const protectedLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.RATE_LIMIT_PROTECTED,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: createRateLimitStore("rl:api-gateway:protected:"),
  skip: (req: Request) => {
    return isPublicPath(getRequestPath(req), req.method);
  },
});
