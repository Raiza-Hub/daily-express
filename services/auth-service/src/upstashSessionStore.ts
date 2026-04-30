import session, { type SessionData } from "express-session";
import type { Redis } from "@upstash/redis";
import { logger, reportError } from "@shared/logger";

type SessionCallback = (err?: unknown) => void;
type GetSessionCallback = (
  err: unknown,
  session?: SessionData | null,
) => void;

interface UpstashSessionStoreOptions {
  client: Redis;
  prefix?: string;
  ttl?: number;
}

export interface RedisHealthState {
  isReady: boolean;
}

export class UpstashSessionStore extends session.Store {
  private readonly client: Redis;
  private readonly prefix: string;
  private readonly ttl: number;
  private readonly healthState: RedisHealthState;

  constructor(
    { client, prefix = "sess:", ttl = 43200 }: UpstashSessionStoreOptions,
    healthState: RedisHealthState,
  ) {
    super();
    this.client = client;
    this.prefix = prefix;
    this.ttl = ttl;
    this.healthState = healthState;
  }

  get(sid: string, callback: GetSessionCallback): void {
    void this.run(
      "get",
      async () => {
        const value = await this.client.get<SessionData>(this.getKey(sid));
        callback(null, value);
      },
      () => {
        callback(null, null);
      },
    );
  }

  set(sid: string, sess: SessionData, callback?: SessionCallback): void {
    void this.run(
      "set",
      async () => {
        const ttl = this.getTTL(sess);

        if (ttl <= 0) {
          await this.client.del(this.getKey(sid));
        } else {
          await this.client.set(this.getKey(sid), sess, {
            ex: ttl,
          });
        }

        callback?.();
      },
      () => {
        callback?.();
      },
    );
  }

  destroy(sid: string, callback?: SessionCallback): void {
    void this.run(
      "destroy",
      async () => {
        await this.client.del(this.getKey(sid));
        callback?.();
      },
      () => {
        callback?.();
      },
    );
  }

  touch(sid: string, sess: SessionData, callback?: () => void): void {
    void this.run(
      "touch",
      async () => {
        const ttl = this.getTTL(sess);

        if (ttl > 0) {
          await this.client.expire(this.getKey(sid), ttl);
        }

        callback?.();
      },
      () => {
        callback?.();
      },
    );
  }

  private getKey(sid: string): string {
    return `${this.prefix}${sid}`;
  }

  private getTTL(sess: SessionData): number {
    const expires = sess.cookie.expires;

    if (expires) {
      return Math.ceil((new Date(expires).getTime() - Date.now()) / 1000);
    }

    return this.ttl;
  }

  private async run(
    operation: string,
    action: () => Promise<void>,
    onError: () => void,
  ): Promise<void> {
    try {
      await action();
      this.healthState.isReady = true;
    } catch (error) {
      this.healthState.isReady = false;
      reportError(error, {
        source: "redis",
        message: "Upstash Redis session operation failed",
        operation,
      });
      logger.error("redis.session_operation_failed", {
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
      onError();
    }
  }
}
