import "dotenv/config";
import express, { type Express } from "express";
import type { Request } from "express";
import helmet from "helmet";
import paymentRoutes from "./payment.routes";
import { errorHandler } from "@shared/middleware";
import { loadConfig } from "./config";
import { startPaymentConsumer } from "./kafka/consumer";
import { createOutboxWorker } from "@shared/kafka";
import { logger } from "@shared/logger";
import { initSentry, sentryServer } from "@shared/sentry";
import { db } from "../db/db";
import { outboxEvents } from "../db/schema";
import { getBoss, stopBoss } from "./boss";
import { startWorkers } from "./workers";

initSentry({ serviceName: "payment-service" });

const app: Express = express();
const config = loadConfig();

app.use(helmet());
app.use(
  express.json({
    limit: "2mb",
    verify: (req: Request, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use("/v1/payments", paymentRoutes);

app.use(errorHandler);

const initializePaymentService = async () => {
  await getBoss();
  await startWorkers();

  const consumer = await startPaymentConsumer();

  const outboxWorker = createOutboxWorker({
    db,
    outboxTable: outboxEvents,
    serviceName: "payment-service",
  });
  await outboxWorker.start();

  const server = app.listen(config.port, () => {
    console.log(`Payment service is running on port ${config.port}`);
  });

  const shutdown = async (signal: string) => {
    logger.info("service.shutdown_requested", { signal });
    await stopBoss();
    await outboxWorker.stop();
    await consumer.disconnect();
    server.close(() => {
      void sentryServer.shutdown().finally(() => {
        logger.info("service.stopped", { signal });
        process.exit(0);
      });
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

initializePaymentService().catch(async (error) => {
  sentryServer.captureException(error, "unknown", {
    action: "initializePaymentService",
  });
  logger.error("service.startup_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  await sentryServer.shutdown();
  process.exit(1);
});

export default app;
