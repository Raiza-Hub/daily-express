import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { corsOptions, errorHandler } from "@shared/middleware";
import { startEmailConsumer } from "./kafka/consumer";
import { logger, reportError } from "@shared/logger";
import { initSentry, sentryServer } from "@shared/sentry";

initSentry({ serviceName: "mail-service" });

const app: Express = express();
const PORT = process.env.PORT || 3008;

app.use(cors(corsOptions()));
app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "mail-service",
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler as unknown as express.ErrorRequestHandler);

const initializeMailService = async () => {
  const consumer = await startEmailConsumer();

  const server = app.listen(PORT, () => {
    console.log(`Mail service is running on port ${PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info("service.shutdown_requested", { signal });
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

initializeMailService().catch(async (error) => {
  sentryServer.captureException(error, "unknown", {
    action: "initializeMailService",
  });
  reportError(error, {
    source: "startup",
    message: "Failed to start mail service",
  });
  await sentryServer.shutdown();
  process.exit(1);
});

export default app;
