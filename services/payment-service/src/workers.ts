import { logger } from "@shared/logger";
import { sentryServer } from "@shared/sentry";
import { getBoss, QUEUES, type PaymentExpireJobData, type WebhookJobData } from "./boss";
import { handlePaymentExpiry } from "./paymentExpireHandler";
import { processWebhookJob } from "./webhookProcessor";

export async function startWorkers() {
  const boss = await getBoss();

  await boss.work<PaymentExpireJobData>(
    QUEUES.PAYMENT_EXPIRE,
    async ([job]) => {
      logger.info("pg_boss.processing_payment_expire", {
        jobId: job.id,
        bookingId: job.data.bookingId,
        reference: job.data.reference,
      });
      try {
        await handlePaymentExpiry(job.data);
      } catch (error) {
        sentryServer.captureException(error, "system", {
          action: "handlePaymentExpiry",
          values: {
            bookingId: job.data.bookingId,
            jobId: job.id,
            reference: job.data.reference,
          },
        });
        throw error;
      }
    },
  );

  await boss.work<WebhookJobData>(
    QUEUES.PROCESS_WEBHOOK,
    async ([job]) => {
      logger.info("pg_boss.processing_webhook", {
        jobId: job.id,
        event: job.data.event,
        reference:
          (job.data.data.reference as string | undefined) ||
          (job.data.data.payment_reference as string | undefined) ||
          null,
      });
      try {
        await processWebhookJob(job.data);
      } catch (error) {
        sentryServer.captureException(error, "system", {
          action: "processWebhookJob",
          values: {
            event: job.data.event,
            jobId: job.id,
            reference:
              (job.data.data.reference as string | undefined) ||
              (job.data.data.payment_reference as string | undefined) ||
              null,
          },
        });
        throw error;
      }
    },
  );

  await boss.work<PaymentExpireJobData>(
    QUEUES.PAYMENT_EXPIRE_DLQ,
    async ([job]) => {
      logger.error("pg_boss.payment_expire_dlq", {
        jobId: job.id,
        bookingId: job.data.bookingId,
        reference: job.data.reference,
      });
    },
  );

  await boss.work<WebhookJobData>(
    QUEUES.PROCESS_WEBHOOK_DLQ,
    async ([job]) => {
      logger.error("pg_boss.webhook_dlq", {
        jobId: job.id,
        event: job.data.event,
        reference:
          (job.data.data.reference as string | undefined) ||
          (job.data.data.payment_reference as string | undefined) ||
          null,
      });
    },
  );

  logger.info("pg_boss.workers_started");
}
