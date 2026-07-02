import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { getConfig } from "../config/index";

const IDEMPOTENCY_PREFIX = "idempotency:booking:";
const IDEMPOTENCY_TTL = 86400;

type CachedEntry<T> = {
  requestHash: string;
  response: T;
};

class IdempotencyService {
  private redis: Redis | null = null;

  private getRedis(): Redis | null {
    if (this.redis) return this.redis;
    const cfg = getConfig();
    if (cfg.LOCATION_UPSTASH_REDIS_REST_URL && cfg.LOCATION_UPSTASH_REDIS_REST_TOKEN) {
      this.redis = new Redis({
        url: cfg.LOCATION_UPSTASH_REDIS_REST_URL,
        token: cfg.LOCATION_UPSTASH_REDIS_REST_TOKEN,
      });
    }
    return this.redis;
  }

  computeRequestHash(body: Record<string, unknown>): string {
    return createHash("sha256").update(JSON.stringify(body)).digest("hex");
  }

  async getCached<T>(key: string, requestHash: string): Promise<{ response: T } | "MISMATCH" | null> {
    const redis = this.getRedis();
    if (!redis) return null;

    try {
      const raw = await redis.get(`${IDEMPOTENCY_PREFIX}${key}`);
      if (!raw) return null;

      const entry = JSON.parse(raw as string) as CachedEntry<T>;
      if (entry.requestHash !== requestHash) return "MISMATCH";

      return { response: entry.response };
    } catch {
      return null;
    }
  }

  async setCache<T>(key: string, requestHash: string, response: T): Promise<void> {
    const redis = this.getRedis();
    if (!redis) return;

    try {
      const entry: CachedEntry<T> = { requestHash, response };
      await redis.set(`${IDEMPOTENCY_PREFIX}${key}`, JSON.stringify(entry), { ex: IDEMPOTENCY_TTL });
    } catch {
      // Best effort — unique index still protects against duplicates
    }
  }
}

export const idempotencyService = new IdempotencyService();
