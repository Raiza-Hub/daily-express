import express, { type Express } from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import driverRoutes from "./driver.routes";
import { errorHandler } from "@shared/middleware";
import { startDriverConsumer } from "./kafka/consumer";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3002;

//setup middleware
app.use(helmet());

//parse JSON bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/v1/driver", driverRoutes);

app.use(errorHandler);

const initializeDriverService = async () => {
  const kafkaEnabled = process.env.KAFKA_ENABLED !== "false";
  const consumer = kafkaEnabled ? await startDriverConsumer() : null;

  const server = app.listen(PORT, () => {
    console.log(`Driver service is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received. Shutting down driver service...`);
    if (consumer) {
      await consumer.disconnect();
    }
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

initializeDriverService().catch((error) => {
  console.error("Failed to start driver service:", error);
  process.exit(1);
});

export default app;
