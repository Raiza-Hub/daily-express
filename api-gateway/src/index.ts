import "dotenv/config";
import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { loadConfig } from "./config/index.js";
import { authMiddleware } from "./middleware/auth.js";
import {
  publicAuthLimiter,
  publicRoutesLimiter,
  protectedLimiter,
} from "./middleware/rateLimiter.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import checkoutRoutes from "./routes/checkout.routes.js";
import driverRoutes from "./routes/driver.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import payoutRoutes from "./routes/payout.routes.js";
import routeRoutes from "./routes/route.routes.js";
import { createRequestLoggingMiddleware } from "./middleware/requestLogger.js";
import { initSentry, sentryServer } from "shared/sentry";

initSentry({ serviceName: "api-gateway" });

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

  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGINS.split(",").map((o: string) => o.trim()),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-User-ID",
        "X-User-Email",
        "X-User-Email-Verified",
        "X-User-Role",
        "X-Request-ID",
        "X-Correlation-ID",
        "baggage",
        "sentry-trace",
      ],
    }),
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(createRequestLoggingMiddleware({ ignorePaths: ["/health"] }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      service: "api-gateway",
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

  app.use(
    "/api/auth",
    publicAuthLimiter,
    authMiddleware,
    protectedLimiter,
    authRoutes,
  );
  app.use(
    "/api/routes",
    publicRoutesLimiter,
    authMiddleware,
    protectedLimiter,
    routeRoutes,
  );
  app.use("/api/drivers", authMiddleware, protectedLimiter, driverRoutes);
  app.use("/api/checkout", authMiddleware, protectedLimiter, checkoutRoutes);
  app.use("/api/payments", authMiddleware, protectedLimiter, paymentRoutes);
  app.use("/api/payouts", authMiddleware, protectedLimiter, payoutRoutes);
  app.use(
    "/api/notifications",
    authMiddleware,
    protectedLimiter,
    notificationRoutes,
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function main() {
  try {
    const config = loadConfig();
    const app = await createApp();

    const server = app.listen(config.PORT, () => {
      console.log(`API Gateway started on port ${config.PORT}`);
      console.log(`Environment: ${config.NODE_ENV}`);
      console.log(`Auth service: ${config.AUTH_SERVICE_URL}`);
      console.log(`Driver service: ${config.DRIVER_SERVICE_URL}`);
      console.log(`Route service: ${config.ROUTE_SERVICE_URL}`);
      console.log(`Payment service: ${config.PAYMENT_SERVICE_URL}`);
      console.log(`Payout service: ${config.PAYOUT_SERVICE_URL}`);
      console.log(`Notification service: ${config.NOTIFICATION_SERVICE_URL}`);
    });

    const shutdown = (signal: string) => {
      console.log(`Shutdown requested: ${signal}`);
      server.close(() => {
        void sentryServer.shutdown().finally(() => {
          console.log(`Server stopped`);
          process.exit(0);
        });
      });

      setTimeout(() => {
        void sentryServer.shutdown().finally(() => {
          console.error(`Forced shutdown: ${signal}`);
          process.exit(1);
        });
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    sentryServer.captureException(error, "unknown", {
      action: "api_gateway_startup",
    });
    console.error("Failed to start API Gateway:", error);
    await sentryServer.shutdown();
    process.exit(1);
  }
}

main();
