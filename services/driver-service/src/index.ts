import "dotenv/config";
import express, { type Express } from "express";
import helmet from "helmet";
import driverRoutes from "./driver.routes";
import { errorHandler } from "@shared/middleware";
import { startDriverConsumer } from "./kafka/consumer";
import { createOutboxWorker } from "@shared/kafka";
import { logger, reportError } from "@shared/logger";
import { initSentry, sentryServer } from "@shared/sentry";
import { db } from "../db/db";
import { outboxEvents } from "../db/schema";

initSentry({ serviceName: "driver-service" });

const app: Express = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "driver-service",
    timestamp: new Date().toISOString(),
  });
});

app.use("/v1/driver", driverRoutes);

app.use(errorHandler);

const initializeDriverService = async () => {
  const consumer = await startDriverConsumer();

  const outboxWorker = createOutboxWorker({
    db,
    outboxTable: outboxEvents,
    serviceName: "driver-service",
  });
  await outboxWorker.start();

  const server = app.listen(PORT, () => {
    console.log(`Driver service is running on port ${PORT}`);
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

initializeDriverService().catch(async (error) => {
  sentryServer.captureException(error, "unknown", {
    action: "initializeDriverService",
  });
  reportError(error, {
    source: "startup",
    message: "Failed to start driver service",
  });
  await sentryServer.shutdown();
  process.exit(1);
});

export default app;
