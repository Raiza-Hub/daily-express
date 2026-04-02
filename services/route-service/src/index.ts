import express, { type Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import routeRoutes from "./route.routes";
import { corsOptions, errorHandler } from "@shared/middleware";
import cookieParser from "cookie-parser";
import { Kafka } from "kafkajs";
import { RouteService } from "./routeService";
import { initializeRouteService } from "./route.controller";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3003;

//setup middleware

app.use(cors(corsOptions()));
app.use(helmet());

//parse JSON bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const kafka = new Kafka({
  clientId: "route-service",
  brokers: ["localhost:9094"],
});

const consumer = kafka.consumer({ groupId: "route-service" });

const startConsumer = async () => {
  try {
    await consumer.connect();
    await consumer.subscribe({
      topics: ["driver-deleted"],
      fromBeginning: true,
    });
    console.log("Kafka consumer connected and subscribed");

    initializeRouteService(consumer);
    const routeService = new RouteService(consumer);
    await routeService.startConsuming();
    console.log("Kafka consumer running");
  } catch (error) {
    console.error("Kafka consumer error:", error);
  }
};

app.use("/v1/route", routeRoutes);

app.use(errorHandler);

startConsumer();
app.listen(PORT, () => {
  console.log(`Route service is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;
