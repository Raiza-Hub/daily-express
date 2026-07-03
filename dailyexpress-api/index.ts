import "dotenv/config";
import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Redis } from "@upstash/redis";
import { loadConfig, getConfig } from "./config/index";
import { authMiddleware } from "./middleware/auth";
import { authLimiter, adminLimiter } from "./middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import authRoutes from "./auth/auth.routes";
import driverRoutes from "./driver/driver.routes";
import routeRoutes from "./route/route.routes";
import adminRoutes from "./admin/admin.routes";
import paymentRoutes from "./payment/payment.routes";
import payoutRoutes from "./payout/payout.routes";
import notificationRoutes from "./notification/notification.routes";
import notificationSSERoutes from "./notification/sse.routes";
import { createRequestLoggingMiddleware } from "./middleware/requestLogger";
import { doubleCsrfProtection, generateCsrfToken } from "./middleware/csrf";
import { sendErrorResponse } from "./middleware/apiResponses";
import { getBoss, stopBoss, isBossRunning } from "./workers/boss";
import { startWorkers } from "./workers/index";
import { sql } from "drizzle-orm";
import { db } from "./db/connection";
import { initSentry, sentryServer } from "@shared/sentry";
import { logger } from "./utils/logger";
import { getClientIp } from "./middleware/utils";

initSentry({ serviceName: "dailyexpress-api" });

async function createApp(): Promise<Express> {
  const config = loadConfig();

  const app = express();
  app.set("trust proxy", config.TRUST_PROXY_HOPS);

  if (
    config.NODE_ENV === "production" &&
    config.ENABLE_PROXY_IP_DEBUG &&
    !config.PROXY_IP_DEBUG_TOKEN
  ) {
    throw new Error(
      "PROXY_IP_DEBUG_TOKEN is required when ENABLE_PROXY_IP_DEBUG is enabled in production.",
    );
  }

  // Security & parsing middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGINS.split(",").map((o: string) => o.trim()),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "X-Correlation-ID",
        "X-Appsmith-Signature",
        "X-CSRF-Token",
        "baggage",
        "sentry-trace",
      ],
    }),
  );

  app.use(cookieParser(config.JWT_SECRET));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(createRequestLoggingMiddleware({ ignorePaths: ["/health", "/health/ready"] }));

  // Initialize pg-boss and start workers
  await getBoss();
  await startWorkers();

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      service: "dailyexpress-api",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
    });
  });

  // Readiness check
  app.get("/health/ready", async (_req, res) => {
    const checks: Record<string, unknown> = {};
    let healthy = true;

    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      checks.database = { status: "ok", latencyMs: Date.now() - start };
    } catch (err) {
      healthy = false;
      checks.database = { status: "error", message: "connection failed" };
    }

    const cfg = getConfig();
    if (cfg.RATE_LIMIT_UPSTASH_REDIS_REST_URL) {
      try {
        const start = Date.now();
        const redis = new Redis({
          url: cfg.RATE_LIMIT_UPSTASH_REDIS_REST_URL,
          token: cfg.RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN!,
        });
        await redis.ping();
        checks.redis = { status: "ok", latencyMs: Date.now() - start };
      } catch {
        healthy = false;
        checks.redis = { status: "error", message: "connection failed" };
      }
    }

    if (cfg.LOCATION_UPSTASH_REDIS_REST_URL) {
      try {
        const start = Date.now();
        const redis = new Redis({
          url: cfg.LOCATION_UPSTASH_REDIS_REST_URL,
          token: cfg.LOCATION_UPSTASH_REDIS_REST_TOKEN!,
        });
        await redis.ping();
        checks.locationCache = { status: "ok", latencyMs: Date.now() - start };
      } catch {
        healthy = false;
        checks.locationCache = { status: "error", message: "connection failed" };
      }
    }

    if (cfg.KYC_UPSTASH_REDIS_REST_URL) {
      try {
        const start = Date.now();
        const redis = new Redis({
          url: cfg.KYC_UPSTASH_REDIS_REST_URL,
          token: cfg.KYC_UPSTASH_REDIS_REST_TOKEN!,
        });
        await redis.ping();
        checks.kycRedis = { status: "ok", latencyMs: Date.now() - start };
      } catch {
        healthy = false;
        checks.kycRedis = { status: "error", message: "connection failed" };
      }
    }

    checks.pgboss = { status: isBossRunning() ? "ok" : "stopped" };

    res.status(healthy ? 200 : 503).json({
      status: healthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    });
  });

  if (config.ENABLE_PROXY_IP_DEBUG) {
    app.get("/debug/proxy-ip", (req, res) => {
      const authHeader = req.header("authorization");
      const headerToken = req.header("x-debug-token");
      const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length)
        : undefined;

      if (
        config.PROXY_IP_DEBUG_TOKEN &&
        headerToken !== config.PROXY_IP_DEBUG_TOKEN &&
        bearerToken !== config.PROXY_IP_DEBUG_TOKEN
      ) {
        sendErrorResponse(res, 404, "We could not find what you requested.", {
          code: "NOT_FOUND",
        });
        return;
      }

      res.json({
        trustProxyHops: config.TRUST_PROXY_HOPS,
        clientIp: getClientIp(req),
        ip: req.ip,
        ips: req.ips,
        rateLimitKey: getClientIp(req),
        socketRemoteAddress: req.socket.remoteAddress,
        headers: {
          cfConnectingIp: req.header("cf-connecting-ip"),
          xRealIp: req.header("x-real-ip"),
          xForwardedFor: req.header("x-forwarded-for"),
          xForwardedProto: req.header("x-forwarded-proto"),
          xForwardedHost: req.header("x-forwarded-host"),
          xRailwayEdge: req.header("x-railway-edge"),
          xRailwayRequestId: req.header("x-railway-request-id"),
        },
      });
    });
  }

  // CSRF token endpoint
  app.get("/api/v1/auth/csrf-token", authMiddleware, (req, res) => {
    const token = generateCsrfToken(req, res);
    res.json({ csrfToken: token });
  });

  // Mount routes
  app.use("/api/v1/auth", authLimiter, authMiddleware, authRoutes);
  app.use("/api/v1/driver", authMiddleware, doubleCsrfProtection, driverRoutes);
  app.use("/api/v1/admin", adminLimiter, adminRoutes);
  app.use("/api/v1/route", authMiddleware, doubleCsrfProtection, routeRoutes);
  app.use("/api/v1/payments", authMiddleware, doubleCsrfProtection, paymentRoutes);
  app.use("/api/v1/payouts", authMiddleware, doubleCsrfProtection, payoutRoutes);
  app.use(
    "/api/v1/notifications",
    authMiddleware,
    doubleCsrfProtection,
    notificationRoutes,
    notificationSSERoutes,
  );
  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function main() {
  try {
    const config = loadConfig();

    process.on("unhandledRejection", (reason) => {
      logger.error("process.unhandled_rejection", { reason: reason instanceof Error ? reason.message : String(reason) });
      sentryServer.captureException(reason, "process", {
        action: "unhandled_rejection",
      });
    });

    process.on("uncaughtException", (error) => {
      logger.error("process.uncaught_exception", { error: error.message });
      sentryServer.captureException(error, "process", {
        action: "uncaught_exception",
      });
      void sentryServer.shutdown().finally(() => process.exit(1));
    });

    const app = await createApp();

    const server = app.listen(config.PORT, () => {
      logger.info("service.started", {
        port: config.PORT,
        environment: config.NODE_ENV,
      });
    });

    const shutdown = (signal: string) => {
      logger.info("service.shutdown_requested", { signal });
      server.close(() => {
        void stopBoss()
          .catch((error) => {
            sentryServer.captureException(error, "system", {
              action: "dailyexpress_api_stop_boss",
              signal,
            });
          })
          .finally(() => {
            void sentryServer.shutdown().finally(() => {
              logger.info("service.stopped", { signal });
              process.exit(0);
            });
          });
      });

      setTimeout(() => {
        void stopBoss()
          .catch((error) => {
            sentryServer.captureException(error, "system", {
              action: "dailyexpress_api_forced_stop_boss",
              signal,
            });
          })
          .finally(() => {
            void sentryServer.shutdown().finally(() => {
              logger.error("service.forced_shutdown", { signal });
              process.exit(1);
            });
          });
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    sentryServer.captureException(error, "unknown", {
      action: "dailyexpress_api_startup",
    });
    logger.error("service.startup_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    await sentryServer.shutdown();
    process.exit(1);
  }
}

main();
