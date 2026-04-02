import "dotenv/config";
import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { loadConfig } from "./config/index.js";
import { authMiddleware } from "./middleware/auth.js";
import {
  publicAuthLimiter,
  publicRoutesLimiter,
  protectedLimiter,
} from "./middleware/rateLimiter.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import driverRoutes from "./routes/driver.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import routeRoutes from "./routes/route.routes.js";

async function createApp(): Promise<Express> {
  const config = loadConfig();

  const app = express();

  app.use(morgan("combined"));
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
      ],
    }),
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      service: "api-gateway",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
    });
  });

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
  app.use("/api/payments", authMiddleware, protectedLimiter, paymentRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function main() {
  try {
    const config = loadConfig();
    const app = await createApp();

    const server = app.listen(config.PORT, () => {
      console.log(`[${new Date().toISOString()}] API Gateway started`);
      console.log(`Port: ${config.PORT}`);
      console.log(`Environment: ${config.NODE_ENV}`);
      console.log(`Auth Service: ${config.AUTH_SERVICE_URL}`);
      console.log(`Driver Service: ${config.DRIVER_SERVICE_URL}`);
      console.log(`Route Service: ${config.ROUTE_SERVICE_URL}`);
      console.log(`Payment Service: ${config.PAYMENT_SERVICE_URL}`);
      console.log(`Health check: http://localhost:${config.PORT}/health`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
      });

      setTimeout(() => {
        console.error("Forcefully shutting down after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start API Gateway:", error);
    process.exit(1);
  }
}

main();
