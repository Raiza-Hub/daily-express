import { PgBoss } from "pg-boss";
import { logger } from "@shared/logger";
import type { KoraWebhookPayload } from "./types";

export const QUEUES = {
  PAYMENT_EXPIRE: "payment.expire",
  PROCESS_WEBHOOK: "process.webhook",
  PAYMENT_EXPIRE_DLQ: "payment.expire.dlq",
  PROCESS_WEBHOOK_DLQ: "process.webhook.dlq",
} as const;

export interface PaymentExpireJobData {
  reference: string;
  bookingId: string;
}

export interface WebhookJobData {
  event: string;
  data: KoraWebhookPayload["data"];
  _retryCount: number;
}

let boss: PgBoss | null = null;

async function createQueues(instance: PgBoss) {
  // DLQs must exist before primary queues can reference them
  await instance.createQueue(QUEUES.PAYMENT_EXPIRE_DLQ, {
    retryLimit: 0,
  });
  await instance.createQueue(QUEUES.PROCESS_WEBHOOK_DLQ, {
    retryLimit: 0,
  });

  await instance.createQueue(QUEUES.PAYMENT_EXPIRE, {
    retryLimit: 2,
    retryDelay: 30,
    retryBackoff: true,
    retryDelayMax: 120,
    deleteAfterSeconds: 86_400,
    deadLetter: QUEUES.PAYMENT_EXPIRE_DLQ,
  });

  await instance.createQueue(QUEUES.PROCESS_WEBHOOK, {
    retryLimit: 3,
    retryDelay: 15,
    retryBackoff: true,
    retryDelayMax: 60,
    deleteAfterSeconds: 86_400,
    deadLetter: QUEUES.PROCESS_WEBHOOK_DLQ,
  });
}

export async function getBoss(): Promise<PgBoss> {
  if (boss) {
    return boss;
  }

  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL as string,
    superviseIntervalSeconds: 30,
    maintenanceIntervalSeconds: 86_400,
    warningSlowQuerySeconds: 10,
    warningQueueSize: 5_000,
  });

  boss.on("error", (error) => {
    logger.error("pg_boss.error", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  boss.on("warning", (warning) => {
    logger.warn("pg_boss.warning", {
      warning,
    });
  });

  await boss.start();
  await createQueues(boss);

  logger.info("pg_boss.started", {
    queues: Object.values(QUEUES),
  });

  return boss;
}

export async function stopBoss() {
  if (!boss) {
    return;
  }

  await boss.stop({
    graceful: true,
    timeout: 15_000,
  });

  boss = null;
  logger.info("pg_boss.stopped");
}
