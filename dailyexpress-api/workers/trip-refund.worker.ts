import { logger } from "../utils/logger";
import { db } from "../db/connection";
import { paymentRepository } from "../payment/payment.repository";
import { paymentPayoutRefundService } from "../payment/payment-payout-refund.service";
import { koraClient } from "../payment/kora.client";
import { enqueueEmail } from "../mail/email-dispatcher.service";
import { jobService } from "./job.service";
import { getBoss, QUEUES, type TripRefundJobData } from "./boss";

const paymentRepo = paymentRepository;
const refundService = paymentPayoutRefundService;
const MAX_REFUND_ATTEMPTS = 3;

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
      const { bookingId, paymentReference, refundReason, emailReason } = job.data;

      logger.error("worker.trip_refund.dlq", {
        jobId: job.id,
        bookingId,
        paymentReference,
      });

      const paymentRecord = await paymentRepo.findPaymentByReference(paymentReference);
      if (!paymentRecord) {
        logger.warn("worker.trip_refund.dlq.payment_not_found", {
          jobId: job.id,
          paymentReference,
        });
        return;
      }

      const pendingRefund = await db.transaction((tx) =>
        paymentRepo.findPendingRefundByPaymentId(tx, paymentRecord.id),
      );
      if (!pendingRefund) {
        logger.warn("worker.trip_refund.dlq.refund_not_found", {
          jobId: job.id,
          paymentReference,
        });
        return;
      }

      const lookup = await koraClient.findPayoutByReference(pendingRefund.reference);

      switch (lookup.kind) {
        case "error":
          logger.error("worker.trip_refund.dlq.lookup_failed", {
            jobId: job.id,
            paymentReference,
            refundReference: pendingRefund.reference,
          });
          return;
        case "notFound":
          break;
        case "found":
          switch (lookup.payout.status.toLowerCase()) {
            case "success":
              await refundService.finalizeRefund(pendingRefund.id, "successful");
              return;
            case "pending":
            case "processing":
              logger.warn("worker.trip_refund.dlq.still_in_flight", {
                jobId: job.id,
                paymentReference,
                refundReference: pendingRefund.reference,
                status: lookup.payout.status,
              });
              return;
            case "failed":
              break;
            default:
              logger.error("worker.trip_refund.dlq.unknown_provider_status", {
                jobId: job.id,
                paymentReference,
                refundReference: pendingRefund.reference,
                status: lookup.payout.status,
              });
              return;
          }
          break;
      }

      const outcome = await db.transaction(async (tx) => {
        const [failed] = await paymentRepo.settleRefund(tx, pendingRefund.id, "failed");
        if (!failed) return "already_terminal" as const;

        const email = await refundService.sendRefundFailureEmail(
          paymentRecord,
          refundReason,
          failed.amount,
          tx,
        );
        if (email) {
          await enqueueEmail(tx, email);
        }

        const attempts = await paymentRepo.countFailedRefundsByPaymentId(
          tx,
          paymentRecord.id,
        );
        if (attempts >= MAX_REFUND_ATTEMPTS) return "exhausted" as const;

        await jobService.enqueueTripRefund(tx, {
          bookingId,
          paymentReference,
          refundReason,
          emailReason,
        });
        return "retry_enqueued" as const;
      });

      switch (outcome) {
        case "already_terminal":
          logger.info("worker.trip_refund.dlq.refund_already_terminal", {
            jobId: job.id,
            paymentReference,
            refundId: pendingRefund.id,
          });
          return;
        case "exhausted":
          logger.error("worker.trip_refund.dlq.attempts_exhausted", {
            jobId: job.id,
            paymentReference,
            attempts: MAX_REFUND_ATTEMPTS,
          });
          return;
        case "retry_enqueued":
          logger.warn("worker.trip_refund.dlq.retry_enqueued", {
            jobId: job.id,
            paymentReference,
          });
          return;
      }
    },
  );
}
