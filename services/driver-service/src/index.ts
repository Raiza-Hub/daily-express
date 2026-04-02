import express, { type Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import driverRoutes from "./driver.routes";
import { corsOptions, errorHandler } from "@shared/middleware";
import cookieParser from "cookie-parser";
import { Kafka } from "kafkajs";
import { initDriverService } from "./driver.controller";
import { DriverService } from "./driverServices";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3002;

//setup middleware

app.use(cors(corsOptions()));
app.use(helmet());

//parse JSON bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/v1/driver", driverRoutes);

//kafka producer
const kafka = new Kafka({
  clientId: "driver-service",
  brokers: [process.env.KAFKA_BROKERS || "localhost:9094"],
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "driver-service" });
const connectToKafka = async () => {
  try {
    await producer.connect();
    await consumer.connect();
    console.log("Kafka producer connected");
    console.log("Kafka consumer connected");

    await consumer.subscribe({ topic: "user-deleted", fromBeginning: true });
    console.log("Kafka consumer connected and subscribed");

    initDriverService(producer, consumer);
    const driverService = new DriverService(producer, consumer);
    await driverService.startConsuming();
    console.log("Kafka consumer running");
  } catch (err) {
    console.log("Kafka producer connection error", err);
  }
};

app.use(errorHandler);

connectToKafka();
const server = app.listen(PORT, () => {
  console.log(`Driver service is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

const shutdown = async () => {
  await producer.disconnect();
  server.close();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;
