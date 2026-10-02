import { eq } from "drizzle-orm";
import { logger } from "../utils/logger";
import { db } from "../db/connection";
import { payment } from "../db/index";
import { paymentRepository } from "../payment/payment.repository";
import { paymentPayoutRefundService } from "../payment/payment-payout-refund.service";
import { enqueueEmail } from "../mail/email-dispatcher.service";
import { getBoss, QUEUES, type TripRefundJobData } from "./boss";

const paymentRepo = paymentRepository;
const refundService = paymentPayoutRefundService;

export async function registerTripRefundWorker() {
  const boss = await getBoss();

  await boss.work<TripRefundJobData>(
    QUEUES.TRIP_REFUND,
    {
      batchSize: 1,
      localConcurrency: 5,
      pollingIntervalSeconds: 2,
    },
    async ([job]) => {
      const { bookingId, paymentReference, refundReason, emailReason } = job.data;

      logger.info("worker.trip_refund.started", {
        jobId: job.id,
        bookingId,
        paymentReference,
      });

      const paymentRecord = await paymentRepo.findPaymentByReference(paymentReference);
      if (!paymentRecord) {
        logger.warn("worker.trip_refund.payment_not_found", {
          jobId: job.id,
          bookingId,
          paymentReference,
        });
        return;
      }

      try {
        await refundService.refundConfirmedBooking(
          paymentRecord,
          refundReason,
          emailReason,
        );

        logger.info("worker.trip_refund.completed", {
          jobId: job.id,
          bookingId,
          paymentReference,
        });
      } catch (error) {
        logger.error("worker.trip_refund.failed", {
          jobId: job.id,
          bookingId,
          paymentReference,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  );

  await boss.work<TripRefundJobData>(
    QUEUES.TRIP_REFUND_DLQ,
    async ([job]) => {
      const { bookingId, paymentReference, refundReason } = job.data;

      logger.error("worker.trip_refund.dlq", {
        jobId: job.id,
        bookingId,
        paymentReference,
      });

      await db.transaction(async (tx) => {
        const [paymentRecord] = await tx
          .select()
          .from(payment)
          .where(eq(payment.reference, paymentReference))
          .limit(1);

        const pendingRefund = paymentRecord
          ? await paymentRepo.findPendingRefundByPaymentId(tx, paymentRecord.id)
          : null;
        if (!pendingRefund) {
          logger.warn("worker.trip_refund.dlq.refund_not_found", {
            jobId: job.id,
            paymentReference,
          });
          return;
        }

        const [failed] = await paymentRepo.settleRefund(tx, pendingRefund.id, "failed");
        if (!failed) {
          logger.info("worker.trip_refund.dlq.refund_already_terminal", {
            jobId: job.id,
            paymentReference,
            refundId: pendingRefund.id,
          });
          return;
        }

        if (paymentRecord) {
          const email = await paymentPayoutRefundService.sendRefundFailureEmail(paymentRecord, refundReason, failed.amount, tx);
          if (email) {
            await enqueueEmail(tx, email);
          }
        }
      });
    },
  );
}
