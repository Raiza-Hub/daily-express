import { eq } from "drizzle-orm";
import { logger } from "../utils/logger";
import { db } from "../db/connection";
import { booking } from "../db/index";
import { paymentRepository } from "../payment/payment.repository";
import { paymentService } from "../payment/payment.service";
import { getPaymentReference } from "../utils/payment";
import { getBoss, QUEUES, type WebhookJobData } from "./boss";

const paymentRepo = paymentRepository;

export async function registerPaymentWebhookWorker() {
  const boss = await getBoss();

  await boss.work<WebhookJobData>(
    QUEUES.WEBHOOK_PROCESS,
    async ([job]) => {
      const reference = getPaymentReference(job.data);

      logger.info("worker.payment_webhook.started", {
        jobId: job.id,
        event: job.data.event,
        reference,
      });

      try {
        await paymentService.handleWebhookJob(job.data);
      } catch (error) {
        logger.error("worker.payment_webhook.failed", {
          jobId: job.id,
          event: job.data.event,
          reference,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  );

  await boss.work<WebhookJobData>(
    QUEUES.WEBHOOK_PROCESS_DLQ,
    async ([job]) => {
      const { event, data } = job.data;

      if (event.startsWith("refund.")) {
        const refundRef = data.reference as string | undefined;
        const paymentRef = data.payment_reference as string | undefined;

        logger.error("worker.payment_webhook.dlq.refund_event", {
          jobId: job.id,
          event,
          refundRef,
          paymentRef,
        });

        if (refundRef) {
          const refundRow = await paymentRepo.findRefundByReference(refundRef);
          if (refundRow && refundRow.status === "pending") {
            const newStatus = event === "refund.success" ? "successful" : "failed";
            await db.transaction(async (tx) => {
              await paymentRepo.updateRefundStatus(tx, refundRow.id, {
                status: newStatus,
                completedAt: new Date(),
              });
              if (paymentRef) {
                await tx
                  .update(booking)
                  .set({
                    paymentStatus: event === "refund.success" ? "refunded" : "refund_failed",
                    updatedAt: new Date(),
                  })
                  .where(eq(booking.paymentReference, paymentRef));
              }
            });
          } else {
            logger.warn("worker.payment_webhook.dlq.refund_not_found", {
              jobId: job.id,
              refundRef,
              currentStatus: refundRow?.status,
            });
          }
        }
        return;
      }

      logger.error("worker.payment_webhook.dlq", {
        jobId: job.id,
        event,
        reference: getPaymentReference(job.data),
      });
    },
  );
}
