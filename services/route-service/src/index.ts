import "dotenv/config";
import express, { type Express } from "express";
import helmet from "helmet";
import routeRoutes from "./route.routes";
import { errorHandler } from "@shared/middleware";
import { startRouteConsumer } from "./kafka/consumer";
import { createOutboxWorker } from "@shared/kafka";
import { logger, reportError } from "@shared/logger";
import { initSentry, sentryServer } from "@shared/sentry";
import { db } from "../db/db";
import { outboxEvents } from "../db/schema";

initSentry({ serviceName: "route-service" });

const app: Express = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "route-service",
    timestamp: new Date().toISOString(),
  });
});

app.use("/v1/route", routeRoutes);

app.use(errorHandler);

const initializeRouteService = async () => {
  const consumer = await startRouteConsumer();

  const outboxWorker = createOutboxWorker({
    db,
    outboxTable: outboxEvents,
    serviceName: "route-service",
  });
  await outboxWorker.start();

  const server = app.listen(PORT, () => {
    console.log(`Route service is running on port ${PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info("service.shutdown_requested", { signal });
    await outboxWorker.stop();
    await consumer.disconnect();
    server.close(async () => {
      await sentryServer.shutdown();
      logger.info("service.stopped", { signal });
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

initializeRouteService().catch(async (error) => {
  sentryServer.captureException(error, "unknown", {
    action: "initializeRouteService",
  });
  reportError(error, {
    source: "startup",
    message: "Failed to start route service",
  });
  await sentryServer.shutdown();
  process.exit(1);
});

export default app;
