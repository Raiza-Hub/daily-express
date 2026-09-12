import { sql, type SQL } from "drizzle-orm";
import {
  QUEUES,
  type EmailSendJobData,
  type TripRefundJobData,
} from "./boss";

export type JobExecutor = {
  execute(query: SQL): Promise<unknown>;
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

  async enqueueTripRefund(
    tx: JobExecutor,
    payload: TripRefundJobData,
  ) {
    await this.enqueue(tx, QUEUES.TRIP_REFUND, payload);
  }

  async enqueueEmail(
    tx: JobExecutor,
    payload: EmailSendJobData,
  ) {
    await this.enqueue(tx, QUEUES.EMAIL_SEND, payload);
  }
}

export const jobService = new JobService();
