import { logger } from "../utils/logger";
import { PaymentService } from "../payment/paymentService";
import { getBoss, QUEUES, type WebhookJobData } from "./boss";

const paymentService = new PaymentService();

function getReference(data: Record<string, unknown>) {
  return (
    (data.reference as string | undefined) ||
    (data.payment_reference as string | undefined) ||
    null
  );
}

export async function registerPaymentWebhookWorker() {
  const boss = await getBoss();

  await boss.work<WebhookJobData>(
    QUEUES.PROCESS_WEBHOOK,
    async ([job]) => {
      logger.info("worker.payment_webhook.started", {
        jobId: job.id,
        event: job.data.event,
        reference: getReference(job.data.data),
      });

      try {
        await paymentService.processWebhookJob(job.data);
      } catch (error) {
        logger.error("worker.payment_webhook.failed", {
          jobId: job.id,
          event: job.data.event,
          reference: getReference(job.data.data),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  );

  await boss.work<WebhookJobData>(
    QUEUES.PROCESS_WEBHOOK_DLQ,
    async ([job]) => {
      logger.error("worker.payment_webhook.dlq", {
        jobId: job.id,
        event: job.data.event,
        reference: getReference(job.data.data),
      });
    },
  );
}
