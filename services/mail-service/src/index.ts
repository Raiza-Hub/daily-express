import express, { type Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import mailRoutes from "./mail.routes";
import { corsOptions, errorHandler } from "@shared/middleware";
import { startEmailConsumer } from "./kafka/consumer";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3008;

app.use(cors(corsOptions()));
app.use(helmet());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/v1/mail", mailRoutes);

app.use(errorHandler as unknown as express.ErrorRequestHandler);

const initializeMailService = async () => {
  const kafkaEnabled = process.env.KAFKA_ENABLED !== "false";
  const consumer = kafkaEnabled ? await startEmailConsumer() : null;

  const server = app.listen(PORT, () => {
    console.log(`Mail service is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received. Shutting down mail service...`);
    if (consumer) {
      await consumer.disconnect();
    }
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

initializeMailService().catch((error) => {
  console.error("Failed to start mail service:", error);
  process.exit(1);
});

export default app;
