import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { Request, RequestHandler, Response } from "express";
import { asyncHandler } from "@shared/middleware";
import { getConfig } from "../config/index";
import { getAuthenticatedUser } from "./auth";
import { sendErrorResponse } from "./apiResponses";
import { logger } from "../utils/logger";

interface TokenBucketConfig {
  capacity: number;
  refillRate: number;
  refillIntervalSec: number;
  prefix: string;
  message?: string;
}

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

export function createTokenBucketLimiter(
  opts: TokenBucketConfig,
): RequestHandler {
  if (!redis) {
    logger.warn("rate_limit.redis_not_configured", { prefix: opts.prefix });
    return (_req, _res, next) => next();
  }

  const ratelimit = new Ratelimit({
    redis,
    prefix: `tb:${opts.prefix}`,
    limiter: Ratelimit.tokenBucket(
      opts.refillRate,
      `${opts.refillIntervalSec} s`,
      opts.capacity,
    ),
  });

  return asyncHandler(async (req: Request, res: Response, next) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      next();
      return;
    }

    let success: boolean;
    let remaining: number;
    try {
      const result = await ratelimit.limit(user.userId);
      success = result.success;
      remaining = result.remaining;
    } catch (error) {
      logger.warn("rate_limit.redis_unavailable", {
        prefix: opts.prefix,
        userId: user.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      next();
      return;
    }

    res.setHeader("X-RateLimit-Remaining", remaining);

    if (!success) {
      sendErrorResponse(
        res,
        429,
        opts.message || "Too many requests. Please slow down.",
        { code: "RATE_LIMITED" },
      );
      return;
    }

    next();
  });
}