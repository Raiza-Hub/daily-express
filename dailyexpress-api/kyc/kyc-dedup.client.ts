import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { getConfig } from "../config/index";
import { logger } from "../utils/logger";
import type { KycDedupEntry, KycType } from "./kyc.types";

export class KycDedupClient {
  private redis: Redis | null = null;

  private getRedis(): Redis {
    if (this.redis) return this.redis;

    const cfg = getConfig();
    if (!cfg.KYC_UPSTASH_REDIS_REST_URL || !cfg.KYC_UPSTASH_REDIS_REST_TOKEN) {
      throw new Error(
        "KYC_UPSTASH_REDIS_REST_URL and KYC_UPSTASH_REDIS_REST_TOKEN must be configured",
      );
    }

    this.redis = new Redis({
      url: cfg.KYC_UPSTASH_REDIS_REST_URL,
      token: cfg.KYC_UPSTASH_REDIS_REST_TOKEN,
    });

    return this.redis;
  }

  hashKyc(kycId: string): string {
    return createHash("sha256").update(kycId).digest("hex");
  }

  private key(hash: string): string {
    return `kyc:dup:${hash}`;
  }

  async checkDuplicate(
    kycId: string,
    driverId: string | null,
    kycType: KycType,
  ): Promise<{
    isDuplicate: boolean;
    existingDriverId?: string;
  }> {
    const hash = this.hashKyc(kycId);
    const redis = this.getRedis();

    const entry: KycDedupEntry = {
      driverId,
      kycType,
      status: driverId ? "pending" : "pending_creation",
      claimedAt: new Date().toISOString(),
    };

    const ttl = driverId ? 7200 : 3600;
    const ok = await redis.set(this.key(hash), JSON.stringify(entry), {
      nx: true,
      ex: ttl,
    });

    if (ok) {
      return { isDuplicate: false };
    }

    const raw = await redis.get<string>(this.key(hash));
    if (!raw) {
      return { isDuplicate: false };
    }

    let existing: KycDedupEntry;
    try {
      existing = JSON.parse(raw) as KycDedupEntry;
    } catch {
      return { isDuplicate: false };
    }

    if (driverId && existing.driverId === driverId) {
      return { isDuplicate: false };
    }

    return {
      isDuplicate: true,
      existingDriverId: existing.driverId ?? undefined,
    };
  }

  async markVerified(
    kycId: string,
    driverId: string,
    kycType: KycType,
  ): Promise<void> {
    const hash = this.hashKyc(kycId);
    const entry: KycDedupEntry = {
      driverId,
      kycType,
      status: "verified",
      claimedAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
    };
    const redis = this.getRedis();
    await redis.set(this.key(hash), JSON.stringify(entry));
    logger.info("kyc.dedup.verified", {
      driverId,
      kycType,
    });
  }

  async releaseClaim(kycId: string): Promise<void> {
    const hash = this.hashKyc(kycId);
    const redis = this.getRedis();
    await redis.del(this.key(hash));
    logger.info("kyc.dedup.released", { hash });
  }
}

export const kycDedupClient = new KycDedupClient();
