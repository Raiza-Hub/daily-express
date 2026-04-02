import express, { type Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import mailRoutes from "./mail.routes";
import { corsOptions, errorHandler } from "@shared/middleware";
import { Kafka } from "kafkajs";
import { MailService } from "./mailService";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3008;

app.use(cors(corsOptions()));
app.use(helmet());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const kafka = new Kafka({
  clientId: "mail-service",
  brokers: ["127.0.0.1:9094"],
});

const consumer = kafka.consumer({ groupId: "mail-service" });

const startConsumer = async () => {
  try {
    await consumer.connect();
    await consumer.subscribe({
      topics: ["user-created", "forgot-password", "driver-created"],
      fromBeginning: true,
    });
    console.log("Kafka consumer connected and subscribed");

    const mailService = new MailService(consumer);
    await mailService.startConsuming();
    console.log("Kafka consumer running");
  } catch (error) {
    console.error("Kafka consumer error:", error);
  }
};

app.use("/v1/mail", mailRoutes);

app.use(errorHandler as unknown as express.ErrorRequestHandler);

const server = app.listen(PORT, () => {
  console.log(`Mail service is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

startConsumer();

const shutdown = async () => {
  await consumer.disconnect();
  server.close();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;
