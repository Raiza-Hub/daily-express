import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { Request, RequestHandler } from "express";
import { asyncHandler } from "@shared/middleware";
import { getConfig } from "../config/index";
import {
  getRequestPath,
  isPublicAuthPath,
} from "./publicPaths";
import { sendErrorResponse } from "./apiResponses";
import { getClientIp } from "./utils";
import { logger } from "../utils/logger";

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

function createSlidingWindowLimiter(options: {
  windowSec: number;
  max: number;
  prefix: string;
  message: string;
  skip?: (req: Request) => boolean;
}): RequestHandler {
  if (!redis) {
    logger.warn("rate_limit.redis_not_configured", { prefix: options.prefix });
    return (_req, _res, next) => next();
  }

  const ratelimit = new Ratelimit({
    redis,
    prefix: `rl:${options.prefix}`,
    limiter: Ratelimit.slidingWindow(options.max, `${options.windowSec} s`),
  });

  return asyncHandler(async (req, res, next) => {
    if (options.skip?.(req)) {
      next();
      return;
    }

    let success: boolean;
    let limit: number;
    let remaining: number;
    let reset: number;
    try {
      const result = await ratelimit.limit(`ip:${getClientIp(req)}`);
      success = result.success;
      limit = result.limit;
      remaining = result.remaining;
      reset = result.reset;
    } catch (error) {
      logger.warn("rate_limit.redis_unavailable", {
        prefix: options.prefix,
        error: error instanceof Error ? error.message : String(error),
      });
      next();
      return;
    }

    res.setHeader("RateLimit-Limit", limit);
    res.setHeader("RateLimit-Remaining", remaining);
    res.setHeader("RateLimit-Reset", Math.ceil(reset / 1000));

    if (!success) {
      sendErrorResponse(res, 429, options.message, {
        code: "RATE_LIMITED",
      });
      return;
    }

    next();
  });
}

export const authLimiter = createSlidingWindowLimiter({
  windowSec: 60,
  max: config.RATE_LIMIT_PUBLIC_AUTH,
  prefix: "auth",
  message: "Too many authentication attempts. Please try again shortly.",
  skip: (req) => !isPublicAuthPath(getRequestPath(req), req.method),
});

export const adminLimiter = createSlidingWindowLimiter({
  windowSec: 60,
  max: 30,
  prefix: "admin",
  message: "Too many admin requests. Please try again shortly.",
});