import { PgBoss } from "pg-boss";
import { logger } from "../utils/logger";

export const QUEUES = {
  EMAIL_SEND: "email.send",
  EMAIL_SEND_DLQ: "email.send.dlq",
  PAYOUT_PROCESS: "payout.process",
  PAYOUT_PROCESS_DLQ: "payout.process.dlq",
  DRIVER_BANK_VERIFICATION: "driver.bank_verification",
  DRIVER_BANK_VERIFICATION_DLQ: "driver.bank_verification.dlq",
  DRIVER_PROFILE_IMAGE_UPLOAD: "driver.profile_image.upload",
  DRIVER_PROFILE_IMAGE_UPLOAD_DLQ: "driver.profile_image.upload.dlq",
  PAYMENT_EXPIRE: "payment.expire",
  PAYMENT_EXPIRE_DLQ: "payment.expire.dlq",
  PROCESS_WEBHOOK: "process.webhook",
  PROCESS_WEBHOOK_DLQ: "process.webhook.dlq",
} as const;

export interface PaymentExpireJobData {
  reference: string;
  bookingId: string;
}

export interface WebhookJobData {
  event: string;
  data: Record<string, unknown>;
  _retryCount: number;
}

export interface DriverBankVerificationJobData {
  driverId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  currency: string;
}

export interface DriverProfileImageUploadJobData {
  uploadId: string;
}

export interface PayoutProcessJobData {
  earningId: string;
}

let boss: PgBoss | null = null;

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
  await instance.createQueue(QUEUES.EMAIL_SEND_DLQ, { retryLimit: 0 });
  await instance.createQueue(QUEUES.PAYOUT_PROCESS_DLQ, { retryLimit: 0 });
  await instance.createQueue(QUEUES.DRIVER_BANK_VERIFICATION_DLQ, {
    retryLimit: 0,
  });
  await instance.createQueue(QUEUES.DRIVER_PROFILE_IMAGE_UPLOAD_DLQ, {
    retryLimit: 0,
  });
  await instance.createQueue(QUEUES.PAYMENT_EXPIRE_DLQ, { retryLimit: 0 });
  await instance.createQueue(QUEUES.PROCESS_WEBHOOK_DLQ, { retryLimit: 0 });

  // Create primary queues
  await instance.createQueue(QUEUES.EMAIL_SEND, {
    retryLimit: 3,
    retryDelay: 15,
    retryBackoff: true,
    retryDelayMax: 60,
    deleteAfterSeconds: 86400,
    deadLetter: QUEUES.EMAIL_SEND_DLQ,
  });

  await instance.createQueue(QUEUES.DRIVER_BANK_VERIFICATION, {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    retryDelayMax: 300,
    deleteAfterSeconds: 86400,
    deadLetter: QUEUES.DRIVER_BANK_VERIFICATION_DLQ,
  });

  await instance.createQueue(QUEUES.DRIVER_PROFILE_IMAGE_UPLOAD, {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    retryDelayMax: 300,
    deleteAfterSeconds: 86400,
    deadLetter: QUEUES.DRIVER_PROFILE_IMAGE_UPLOAD_DLQ,
  });

  await instance.createQueue(QUEUES.PAYOUT_PROCESS, {
    retryLimit: 0,
    retryDelay: 30,
    retryBackoff: true,
    retryDelayMax: 300,
    expireInSeconds: Number(process.env.PAYOUT_JOB_EXPIRE_MINUTES || 15) * 60,
    deleteAfterSeconds: 86400,
    deadLetter: QUEUES.PAYOUT_PROCESS_DLQ,
  });

  await instance.createQueue(QUEUES.PAYMENT_EXPIRE, {
    retryLimit: 2,
    retryDelay: 30,
    retryBackoff: true,
    retryDelayMax: 120,
    deleteAfterSeconds: 86400,
    deadLetter: QUEUES.PAYMENT_EXPIRE_DLQ,
  });

  await instance.createQueue(QUEUES.PROCESS_WEBHOOK, {
    retryLimit: 3,
    retryDelay: 15,
    retryBackoff: true,
    retryDelayMax: 60,
    deleteAfterSeconds: 86400,
    deadLetter: QUEUES.PROCESS_WEBHOOK_DLQ,
  });

  logger.info("pg_boss.queues_created");
}

export async function stopBoss() {
  if (!boss) return;
  await boss.stop({ graceful: true, timeout: 15000 });
  boss = null;
  logger.info("pg_boss.stopped");
}
