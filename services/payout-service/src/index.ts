import "dotenv/config";
import express, { type Express, type Request } from "express";
import helmet from "helmet";
import payoutRoutes from "./payout.routes";
import { errorHandler } from "@shared/middleware";
import { loadConfig } from "./config";
import { startPayoutConsumer } from "./kafka/consumer";
import { PayoutService } from "./payoutService";
import { createOutboxWorker } from "@shared/kafka";
import { logger, reportError } from "@shared/logger";
import { initSentry, sentryServer } from "@shared/sentry";
import { db } from "../db/db";
import { outboxEvents } from "../db/schema";
import { startBoss, stopBoss } from "./queue";
import {
  registerFailedJobHandler,
  registerPayoutWorker,
  startPayoutWorker,
} from "./payoutWorker";

initSentry({ serviceName: "payout-service" });

const app: Express = express();
const config = loadConfig();
const payoutService = new PayoutService();

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

app.use("/v1/payouts", payoutRoutes);

app.use(errorHandler);

export const initializePayoutService = async () => {
  const consumer = await startPayoutConsumer();

  const outboxWorker = createOutboxWorker({
    db,
    outboxTable: outboxEvents,
    serviceName: "payout-service",
  });
  await outboxWorker.start();

  await startBoss();

  registerPayoutWorker(payoutService);
  await startPayoutWorker();
  await registerFailedJobHandler();

  const server = app.listen(config.port, () => {
    console.log(`Payout service is running on port ${config.port}`);
  });

  const shutdown = async (signal: string) => {
    logger.info("service.shutdown_requested", { signal });
    await outboxWorker.stop();
    await stopBoss();
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

if (process.env.NODE_ENV !== "test") {
  initializePayoutService().catch(async (error) => {
    sentryServer.captureException(error, "unknown", {
      action: "initializePayoutService",
    });
    reportError(error, {
      source: "startup",
      message: "Failed to start payout service",
    });
    await sentryServer.shutdown();
    process.exit(1);
  });
}

export default app;
