import { Redis } from "@upstash/redis";
import type { Request, RequestHandler, Response } from "express";
import { getConfig } from "../config/index";
import { getAuthenticatedUser } from "./auth";
import { sendErrorResponse } from "./apiResponses";
import { asyncHandler } from "@shared/middleware";
import { logger } from "../utils/logger";

const LUA_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local refill_interval = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
    tokens = capacity
    last_refill = now
end

local time_passed = now - last_refill
local refills = math.floor(time_passed / refill_interval)

if refills > 0 then
    tokens = math.min(capacity, tokens + (refills * refill_rate))
    last_refill = last_refill + (refills * refill_interval)
end

local allowed = 0
if tokens >= 1 then
    tokens = tokens - 1
    allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
redis.call('EXPIRE', key, math.ceil((refill_interval * (capacity / refill_rate)) + 60))

return {allowed, tokens}
`;

interface TokenBucketConfig {
  capacity: number;
  refillRate: number;
  refillIntervalSec: number;
  prefix: string;
  message?: string;
}

const config = getConfig();
const redis =
  config.RATE_LIMIT_UPSTASH_REDIS_REST_URL &&
  config.RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: config.RATE_LIMIT_UPSTASH_REDIS_REST_URL,
        token: config.RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export async function consumeToken(
  key: string,
  capacity: number,
  refillRate: number,
  refillIntervalSec: number,
): Promise<{ allowed: boolean; remaining: number }> {
  if (!redis) {
    logger.warn("rate_limit.redis_not_configured", { key });
    return { allowed: true, remaining: capacity };
  }

  const now = Math.floor(Date.now() / 1000);
  let result: unknown;
  try {
    result = await redis.eval(
      LUA_SCRIPT,
      [key],
      [capacity, refillRate, refillIntervalSec, now],
    );
  } catch (error) {
    logger.warn("rate_limit.redis_unavailable", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return { allowed: true, remaining: capacity };
  }

  const [allowed, remaining] = result as [number, number];
  return { allowed: allowed === 1, remaining };
}

export function createTokenBucketLimiter(
  opts: TokenBucketConfig,
): RequestHandler {
  return asyncHandler(async (req: Request, res: Response, next) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      next();
      return;
    }

    const key = `tb:${opts.prefix}:${user.userId}`;
    const { allowed, remaining } = await consumeToken(
      key,
      opts.capacity,
      opts.refillRate,
      opts.refillIntervalSec,
    );

    res.setHeader("X-RateLimit-Remaining", remaining);

    if (!allowed) {
      sendErrorResponse(res, 429, opts.message || "Too many requests. Please slow down.", {
        code: "RATE_LIMITED",
      });
      return;
    }

    next();
  });
}
