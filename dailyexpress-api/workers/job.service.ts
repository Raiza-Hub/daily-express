import { sql, type SQL } from "drizzle-orm";
import {
  QUEUES,
  type DriverVerificationJobData,
  type PayoutProcessJobData,
  type TripRefundJobData,
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

export class JobService {
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
  }

  async enqueueEmail(
    tx: JobExecutor,
    emailName: `email.${string}`,
    payload: EmailJobPayload,
  ) {
    await this.enqueue(tx, QUEUES.EMAIL_SEND, { emailName, ...payload });
  }

  async enqueueDriverVerification(
    tx: JobExecutor,
    payload: DriverVerificationJobData,
  ) {
    await this.enqueue(tx, QUEUES.DRIVER_VERIFICATION, payload);
  }

  async enqueuePaymentWebhook(tx: JobExecutor, payload: WebhookJobData) {
    await this.enqueue(tx, QUEUES.WEBHOOK_PROCESS, payload);
  }

  async enqueuePayout(
    tx: JobExecutor,
    payload: PayoutProcessJobData,
    startAfter?: Date,
  ) {
    await this.enqueue(tx, QUEUES.PAYOUT_PROCESS, payload, {
      startAfter,
      singletonKey: payload.tripId,
    });
  }

  async enqueueTripRefund(
    tx: JobExecutor,
    payload: TripRefundJobData,
  ) {
    await this.enqueue(tx, QUEUES.TRIP_REFUND, payload);
  }
}

export const jobService = new JobService();
