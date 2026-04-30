import { Request, Response, NextFunction } from "express";
import { logger } from "@shared/logger";
import type { RedisHealthState } from "../upstashSessionStore";

/**
 * Middleware to check if Redis connection is ready.
 * Prevents requests from hanging or failing with internal errors if the session store is down.
 */
export const redisHealthCheck = (redisHealthState: RedisHealthState) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply health check to authentication routes that depend on sessions
    if (!redisHealthState.isReady && req.path.startsWith("/v1/auth")) {
      logger.error("redis.unavailable", {
        source: "middleware",
        redis_status: "unavailable",
        path: req.path,
      });
      return res.status(503).json({
        error: "Service Temporarily Unavailable",
        message:
          "Authentication session store is offline. Please try again later.",
      });
    }
    return next();
  };
};
