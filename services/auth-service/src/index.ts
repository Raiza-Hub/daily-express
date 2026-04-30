import "dotenv/config";
import express, { type Express } from "express";
import helmet from "helmet";
import session from "express-session";
import cookieParser from "cookie-parser";
import { Redis, type RedisConfigNodejs } from "@upstash/redis";
import authRoutes from "./auth.routes";
import { errorHandler } from "@shared/middleware";
import {
  UpstashSessionStore,
  type RedisHealthState,
} from "./upstashSessionStore";
import passport from "./passport";
import { startOutboxPublisher } from "./kafka/outbox";
import { logger, reportError } from "@shared/logger";
import { initSentry, sentryServer } from "@shared/sentry";

initSentry({ serviceName: "auth-service" });

const app: Express = express();
const PORT = process.env.PORT;
const REDIS_CONNECT_RETRIES = parseInt(
  process.env.REDIS_CONNECT_RETRIES || "20",
  10,
);
const REDIS_CONNECT_RETRY_DELAY_MS = parseInt(
  process.env.REDIS_CONNECT_RETRY_DELAY_MS || "3000",
  10,
);

function getCookieDomain() {
  if (process.env.NODE_ENV !== "production") {
    return undefined;
  }

  return process.env.COOKIE_DOMAIN || ".dailyexpress.app";
}

function getUpstashRedisConfig(): Pick<RedisConfigNodejs, "url" | "token"> {
  const url =
    process.env.SESSION_UPSTASH_REDIS_REST_URL ||
    process.env.AUTH_UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.SESSION_UPSTASH_REDIS_REST_TOKEN ||
    process.env.AUTH_UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Upstash Redis is required for auth sessions. Please set SESSION_UPSTASH_REDIS_REST_URL and SESSION_UPSTASH_REDIS_REST_TOKEN.",
    );
  }

  return { url, token };
}

const redisHealthState: RedisHealthState = { isReady: false };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function connectRedisWithRetry(redisClient: Redis): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= REDIS_CONNECT_RETRIES; attempt += 1) {
    try {
      await redisClient.ping();
      redisHealthState.isReady = true;

      if (attempt > 1) {
        logger.info("redis.connected_after_retry", {
          attempt,
          maxAttempts: REDIS_CONNECT_RETRIES,
        });
      }

      return;
    } catch (error) {
      lastError = error;
      redisHealthState.isReady = false;
      sentryServer.captureException(error, "system", {
        action: "redis_connect_attempt_failed",
      });
      reportError(error, {
        source: "redis",
        message: "Upstash Redis connect attempt failed",
        attempt,
        maxAttempts: REDIS_CONNECT_RETRIES,
      });

      if (attempt < REDIS_CONNECT_RETRIES) {
        await sleep(REDIS_CONNECT_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Upstash Redis failed to connect after retries");
}

const initializeAuthService = async () => {
  const redisClient = new Redis(getUpstashRedisConfig());

  await connectRedisWithRetry(redisClient);

  const redisStore = new UpstashSessionStore(
    {
      client: redisClient,
      prefix: "sess:",
      ttl: 43200,
    },
    redisHealthState,
  );
  const cookieDomain = getCookieDomain();

  app.use(helmet());

  app.use(cookieParser());

  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      store: redisStore,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      service: "auth-service",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/v1/auth", authRoutes);

  app.use(errorHandler);

  const outboxPublisher = await startOutboxPublisher();

  const server = app.listen(PORT, () => {
    console.log(`Auth service is running on port ${PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info("service.shutdown_requested", { signal });
    await outboxPublisher.stop();
    server.close(async () => {
      await sentryServer.shutdown();
      logger.info("service.stopped", { signal });
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

initializeAuthService().catch(async (error) => {
  sentryServer.captureException(error, "unknown", {
    action: "initializeAuthService",
  });
  reportError(error, {
    source: "startup",
    message: "Failed to start auth service",
  });
  await sentryServer.shutdown();
  process.exit(1);
});
export default app;
