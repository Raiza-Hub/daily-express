import { sql, type SQL } from "drizzle-orm";
import {
  QUEUES,
  type DriverBankVerificationJobData,
  type DriverProfileImageUploadJobData,
  type PaymentExpireJobData,
  type PayoutProcessJobData,
  type WebhookJobData,
} from "./boss";

type JobExecutor = {
  execute(query: SQL): Promise<unknown>;
};

type EmailJobPayload = {
  to: string;
  subject: string;
  html: string;
};

function toPgTimestamp(value?: Date) {
  return value ? value.toISOString() : null;
}

export const jobService = {
  async enqueue(
    tx: JobExecutor,
    queueName: string,
    payload: object,
    options?: { startAfter?: Date; singletonKey?: string },
  ) {
    const startAfter = toPgTimestamp(options?.startAfter);

    await tx.execute(sql`
      INSERT INTO pgboss.job (
        name,
        data,
        singleton_key,
        priority,
        start_after,
        expire_seconds,
        deletion_seconds,
        keep_until,
        retry_limit,
        retry_delay,
        retry_backoff,
        retry_delay_max,
        policy,
        dead_letter,
        heartbeat_seconds
      )
      SELECT
        ${queueName},
        ${JSON.stringify(payload)}::jsonb,
        ${options?.singletonKey || null},
        0,
        COALESCE(${startAfter}::timestamptz, now()),
        q.expire_seconds,
        q.deletion_seconds,
        now() + (q.retention_seconds * interval '1 second'),
        q.retry_limit,
        q.retry_delay,
        q.retry_backoff,
        q.retry_delay_max,
        q.policy,
        q.dead_letter,
        q.heartbeat_seconds
      FROM pgboss.queue q
      WHERE q.name = ${queueName}
    `);
  },

  async enqueueEmail(
    tx: JobExecutor,
    emailName: `email.${string}`,
    payload: EmailJobPayload,
  ) {
    await this.enqueue(tx, QUEUES.EMAIL_SEND, { emailName, ...payload });
  },

  async enqueueDriverBankVerification(
    tx: JobExecutor,
    payload: DriverBankVerificationJobData,
  ) {
    await this.enqueue(tx, QUEUES.DRIVER_BANK_VERIFICATION, payload);
  },

  async enqueueDriverProfileImageUpload(
    tx: JobExecutor,
    payload: DriverProfileImageUploadJobData,
  ) {
    await this.enqueue(tx, QUEUES.DRIVER_PROFILE_IMAGE_UPLOAD, payload, {
      singletonKey: payload.uploadId,
    });
  },

  async enqueuePaymentWebhook(tx: JobExecutor, payload: WebhookJobData) {
    await this.enqueue(tx, QUEUES.PROCESS_WEBHOOK, payload);
  },

  async enqueuePaymentExpiry(
    tx: JobExecutor,
    payload: PaymentExpireJobData,
    startAfter: Date,
  ) {
    const startAfterTimestamp = toPgTimestamp(startAfter);

    await tx.execute(sql`
      INSERT INTO pgboss.job (
        name,
        data,
        priority,
        start_after,
        expire_seconds,
        deletion_seconds,
        keep_until,
        retry_limit,
        retry_delay,
        retry_backoff,
        retry_delay_max,
        policy,
        dead_letter,
        heartbeat_seconds
      )
      SELECT
        ${QUEUES.PAYMENT_EXPIRE},
        ${JSON.stringify(payload)}::jsonb,
        0,
        COALESCE(${startAfterTimestamp}::timestamptz, now()),
        q.expire_seconds,
        q.deletion_seconds,
        now() + (q.retention_seconds * interval '1 second'),
        q.retry_limit,
        q.retry_delay,
        q.retry_backoff,
        q.retry_delay_max,
        q.policy,
        q.dead_letter,
        q.heartbeat_seconds
      FROM pgboss.queue q
      WHERE q.name = ${QUEUES.PAYMENT_EXPIRE}
    `);
  },

  async enqueuePayout(
    tx: JobExecutor,
    payload: PayoutProcessJobData,
    startAfter?: Date,
  ) {
    await this.enqueue(tx, QUEUES.PAYOUT_PROCESS, payload, {
      startAfter,
      singletonKey: payload.earningId,
    });
  },
};
