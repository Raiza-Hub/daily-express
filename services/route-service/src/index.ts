import express, { type Express } from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import routeRoutes from "./route.routes";
import { errorHandler } from "@shared/middleware";
import { startRouteConsumer } from "./kafka/consumer";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3003;

//setup middleware
app.use(helmet());

//parse JSON bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/v1/route", routeRoutes);

app.use(errorHandler);

const initializeRouteService = async () => {
  const kafkaEnabled = process.env.KAFKA_ENABLED !== "false";
  const consumer = kafkaEnabled ? await startRouteConsumer() : null;

  const server = app.listen(PORT, () => {
    console.log(`Route service is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received. Shutting down route service...`);
    if (consumer) {
      await consumer.disconnect();
    }
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

initializeRouteService().catch((error) => {
  console.error("Failed to start route service:", error);
  process.exit(1);
});

export default app;
