import { KAFKA_CONFIG } from "./config";
import { logger } from "../logger";
import { Redis, type RedisConfigNodejs } from "@upstash/redis";

let redisClient: Redis | null = null;

function getServiceName(): string {
  return process.env.SERVICE_NAME || "unknown";
}

function getUpstashRedisConfig(): Pick<RedisConfigNodejs, "url" | "token"> {
  const url =
    process.env.KAFKA_IDEMPOTENCY_UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KAFKA_IDEMPOTENCY_UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Upstash Redis is required for Kafka idempotency. Please set KAFKA_IDEMPOTENCY_UPSTASH_REDIS_REST_URL and KAFKA_IDEMPOTENCY_UPSTASH_REDIS_REST_TOKEN.",
    );
  }

  return { url, token };
}

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(getUpstashRedisConfig());
  }
  return redisClient;
}

export async function checkIdempotency(
  eventId: string,
  _consumerGroup: string,
): Promise<boolean> {
  // Key format: ${serviceName}:idempotency:${eventId}
  // Example: payment-service:idempotency:abc-123
  const serviceName = getServiceName();
  const key = `${serviceName}:idempotency:${eventId}`;

  try {
    const redis = getRedisClient();
    const result = await redis.set(key, "1", {
      nx: true,
      ex: KAFKA_CONFIG.idempotency.ttlSeconds,
    });
    return result !== "OK";
  } catch (error) {
    logger.warn("kafka.redis_unavailable_using_db_fallback", {
      eventId,
      error,
    });
    return false;
  }
}

export async function markAsProcessed(
  eventId: string,
  _consumerGroup: string,
): Promise<void> {
  const serviceName = getServiceName();
  const key = `${serviceName}:idempotency:${eventId}`;

  try {
    const redis = getRedisClient();
    await redis.set(key, "1", {
      ex: KAFKA_CONFIG.idempotency.ttlSeconds,
    });
  } catch (error) {
    logger.error("kafka.idempotency_mark_failed", { eventId, error });
  }
}

export async function isEventProcessed(
  eventId: string,
  _consumerGroup: string,
): Promise<boolean> {
  const serviceName = getServiceName();
  const key = `${serviceName}:idempotency:${eventId}`;

  try {
    const redis = getRedisClient();
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    logger.warn("kafka.redis_check_failed_fallback", { eventId, error });
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  redisClient = null;
}
