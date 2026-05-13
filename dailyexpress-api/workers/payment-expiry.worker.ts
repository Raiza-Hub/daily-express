import { logger } from "../utils/logger";
import { PaymentService } from "../payment/paymentService";
import { getBoss, QUEUES, type PaymentExpireJobData } from "./boss";

const paymentService = new PaymentService();

export async function registerPaymentExpiryWorker() {
  const boss = await getBoss();

  await boss.work<PaymentExpireJobData>(
    QUEUES.PAYMENT_EXPIRE,
    {
      batchSize: 1,
      localConcurrency: 3,
      pollingIntervalSeconds: 2,
      heartbeatRefreshSeconds: 30,
    },
    async ([job]) => {
      logger.info("worker.payment_expiry.started", {
        jobId: job.id,
        bookingId: job.data.bookingId,
        reference: job.data.reference,
      });

      try {
        await paymentService.handlePaymentExpiry(job.data);
      } catch (error) {
        logger.error("worker.payment_expiry.failed", {
          jobId: job.id,
          bookingId: job.data.bookingId,
          reference: job.data.reference,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  );

  await boss.work<PaymentExpireJobData>(
    QUEUES.PAYMENT_EXPIRE_DLQ,
    {
      batchSize: 1,
      localConcurrency: 1,
      pollingIntervalSeconds: 5,
      heartbeatRefreshSeconds: 30,
    },
    async ([job]) => {
      logger.error("worker.payment_expiry.dlq", {
        jobId: job.id,
        bookingId: job.data.bookingId,
        reference: job.data.reference,
      });
    },
  );
}
