import express, { type Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import session from "express-session";
import cookieParser from "cookie-parser";
import { createClient, type RedisClientType } from "redis";
import type { RedisStore as ConnectRedisStoreType } from "connect-redis";
import authRoutes from "./auth.routes";
import { corsOptions, errorHandler } from "@shared/middleware";
import { redisHealthCheck } from "./middleware/redis.middleware";
import passport from "./passport";
import { Kafka } from "kafkajs";
import { initAuthService } from "./auth.controller";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err.message || err);
});

redisClient.on("connect", () => {
  console.log("Redis client connecting...");
});

redisClient.on("ready", () => {
  console.log("Redis client is ready and connected");
});

// Wrap in async IIFE to handle top-level await
const initializeRedis = async () => {
  await redisClient.connect();

  const redisStore: ConnectRedisStoreType = new (
    await import("connect-redis")
  ).RedisStore({
    client: redisClient,
    prefix: "sess:",
    ttl: 43200, // 12 hours
  });

  app.use(cors(corsOptions()));
  app.use(helmet());

  app.use(cookieParser());
  app.use(redisHealthCheck(redisClient));

  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      store: redisStore,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  const kafka = new Kafka({
    clientId: "auth-service",
    brokers: ["127.0.0.1:9094"],
  });

  const producer = kafka.producer();

  const connectToKafka = async () => {
    try {
      await producer.connect();
      console.log("Kafka producer connected");
      initAuthService(producer);
    } catch (err) {
      console.log("Kafka producer connection error", err);
    }
  };

  app.use("/v1/auth", authRoutes);

  app.use(errorHandler);

  await connectToKafka();

  const server = app.listen(PORT, () => {
    console.log(`Auth service is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });

  const shutdown = async () => {
    await producer.disconnect();
    server.close();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

initializeRedis();
export default app;
