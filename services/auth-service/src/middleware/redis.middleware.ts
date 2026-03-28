import { Request, Response, NextFunction } from "express";
import type { RedisClientType } from "redis";

/**
 * Middleware to check if Redis connection is ready.
 * Prevents requests from hanging or failing with internal errors if the session store is down.
 * @param redisClient The node-redis client instance to check.
 */
export const redisHealthCheck = (redisClient: RedisClientType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply health check to authentication routes that depend on sessions
    if (!redisClient.isReady && req.path.startsWith("/v1/auth")) {
      console.error(
        `Redis connection unavailable (Status: ${redisClient.isOpen ? "open" : "closed"}). Blocking request to: ${req.path}`,
      );
      return res.status(503).json({
        error: "Service Temporarily Unavailable",
        message:
          "Authentication session store is offline. Please try again later.",
      });
    }
    return next();
  };
};
