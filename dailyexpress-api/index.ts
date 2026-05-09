import "dotenv/config";
import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { loadConfig } from "./config/index";
import { authMiddleware } from "./middleware/auth";
import {
  publicRoutesLimiter,
  authLimiter,
  protectedLimiter,
  webhookLimiter,
} from "./middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import authRoutes from "./auth/auth.routes";
import driverRoutes from "./driver/driver.routes";
import routeRoutes from "./route/route.routes";
import paymentRoutes from "./payment/payment.routes";
import payoutRoutes from "./payout/payout.routes";
import notificationRoutes from "./notification/notification.routes";
import { createRequestLoggingMiddleware } from "./middleware/requestLogger";
import { getBoss, stopBoss, startWorkers } from "./workers/index";
import { initSentry, sentryServer } from "@shared/sentry";
import { logger } from "./utils/logger";

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
        "baggage",
        "sentry-trace",
      ],
    }),
  );

app.use(cookieParser(config.JWT_SECRET));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(createRequestLoggingMiddleware({ ignorePaths: ["/health"] }));

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
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }

      res.json({
        trustProxyHops: config.TRUST_PROXY_HOPS,
        ip: req.ip,
        ips: req.ips,
        rateLimitKey: req.ip,
        socketRemoteAddress: req.socket.remoteAddress,
        headers: {
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

  // Mount routes with rate limiting and auth
  app.use(
    "/api/v1/auth",
    authLimiter,
    authMiddleware,
    protectedLimiter,
    authRoutes,
  );
  app.use(
    "/api/v1/driver",
    authMiddleware,
    protectedLimiter,
    driverRoutes,
  );
  app.use(
    "/api/v1/route",
    publicRoutesLimiter,
    authMiddleware,
    protectedLimiter,
    routeRoutes,
  );
  app.use(
    "/api/v1/payments",
    webhookLimiter,
    authMiddleware,
    protectedLimiter,
    paymentRoutes,
  );
  app.use(
    "/api/v1/payouts",
    webhookLimiter,
    authMiddleware,
    protectedLimiter,
    payoutRoutes,
  );
  app.use(
    "/api/v1/notifications",
    authMiddleware,
    protectedLimiter,
    notificationRoutes,
  );
  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function main() {
  try {
    const config = loadConfig();
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
