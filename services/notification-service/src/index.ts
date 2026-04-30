import "dotenv/config";
import express, { type Express } from "express";
import helmet from "helmet";
import notificationRoutes from "./notification.routes";
import { errorHandler } from "@shared/middleware";
import { loadConfig } from "./config";
import { startNotificationConsumer } from "./kafka/consumer";
import { logger, reportError } from "@shared/logger";
import { initSentry, sentryServer } from "@shared/sentry";
import { getBoss, stopBoss } from "./boss";
import { startWorkers } from "./workers";

initSentry({ serviceName: "notification-service" });

const app: Express = express();
const config = loadConfig();

app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/v1", notificationRoutes);

app.use(errorHandler);

const initializeNotificationService = async () => {
  await getBoss();
  await startWorkers();

  const consumer = await startNotificationConsumer();

  const server = app.listen(config.port, () => {
    console.log(`Notification service is running on port ${config.port}`);
  });

  const shutdown = async (signal: string) => {
    logger.info("service.shutdown_requested", { signal });
    await consumer.disconnect();
    await stopBoss();
    server.close(async () => {
      await sentryServer.shutdown();
      logger.info("service.stopped", { signal });
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

initializeNotificationService().catch(async (error) => {
  sentryServer.captureException(error, "unknown", {
    action: "initializeNotificationService",
  });
  reportError(error, {
    source: "startup",
    message: "Failed to start notification service",
  });
  await sentryServer.shutdown();
  process.exit(1);
});

export default app;
