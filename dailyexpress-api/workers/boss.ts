import { PgBoss } from "pg-boss";
import { logger } from "../utils/logger";

export const QUEUES = {
  TRIP_REFUND: "trip.refund",
  TRIP_REFUND_DLQ: "trip.refund.dlq",

  EMAIL_SEND: "email.send",
  EMAIL_SEND_DLQ: "email.send.dlq",

  PAYER_INFO: "payment.payer-info",
  PAYER_INFO_DLQ: "payment.payer-info.dlq",
} as const;

export interface WebhookJobData {
  event: string;
  data: Record<string, unknown>;
  _retryCount: number;
}

export interface TripRefundJobData {
  bookingId: string;
  paymentReference: string;
  refundReference: string;
  refundReason: string;
  emailReason?: "driver_deactivated" | "no_driver_found" | "admin_cancelled";
}

export interface EmailSendJobData {
  emailName: string;
  to: string;
  subject: string;
  html: string;
}

export interface PayerInfoJobData {
  reference: string;
}

let boss: PgBoss | null = null;

export function isBossRunning(): boolean {
  return boss !== null;
}

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;

  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL as string,
    superviseIntervalSeconds: 30,
    maintenanceIntervalSeconds: 86400,
    warningSlowQuerySeconds: 10,
    warningQueueSize: 5000,
  });

  boss.on("error", (error) => {
    logger.error("pg_boss.error", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  boss.on("warning", (warning) => {
    logger.warn("pg_boss.warning", { warning });
  });

  await boss.start();
  await createQueues(boss);

  logger.info("pg_boss.started", { queues: Object.values(QUEUES) });
  return boss;
}

async function createQueues(instance: PgBoss) {
  // Create DLQs first
  await instance.createQueue(QUEUES.TRIP_REFUND_DLQ, { retryLimit: 0 });

  await instance.createQueue(QUEUES.EMAIL_SEND_DLQ, { retryLimit: 0 });

  await instance.createQueue(QUEUES.PAYER_INFO_DLQ, { retryLimit: 0 });

  // Create primary queues
  await instance.createQueue(QUEUES.TRIP_REFUND, {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    retryDelayMax: 300,
    deleteAfterSeconds: 86400,
    deadLetter: QUEUES.TRIP_REFUND_DLQ,
  });

  await instance.createQueue(QUEUES.EMAIL_SEND, {
    retryLimit: 3,
    retryDelay: 10,
    retryBackoff: true,
    retryDelayMax: 60,
    deleteAfterSeconds: 86400,
    deadLetter: QUEUES.EMAIL_SEND_DLQ,
  });

  await instance.createQueue(QUEUES.PAYER_INFO, {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    retryDelayMax: 300,
    deleteAfterSeconds: 86400,
    deadLetter: QUEUES.PAYER_INFO_DLQ,
  });

  logger.info("pg_boss.queues_created");
}

export async function stopBoss() {
  if (!boss) return;
  await boss.stop({ graceful: true, timeout: 15000 });
  boss = null;
  logger.info("pg_boss.stopped");
}
