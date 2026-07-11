import { eq } from "drizzle-orm";
import { logger } from "../utils/logger";
import { db } from "../db/connection";
import { booking, payment, refund } from "../db/index";
import { paymentRepository } from "../payment/payment.repository";
import { paymentPayoutRefundService } from "../payment/payment-payout-refund.service";
import { generateReference } from "../utils/payment";
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
      const { bookingId, paymentReference, refundReference, refundReason, emailReason } = job.data;

      logger.info("worker.trip_refund.started", {
        jobId: job.id,
        bookingId,
        paymentReference,
        refundReference,
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
          refundReference,
        );

        logger.info("worker.trip_refund.completed", {
          jobId: job.id,
          bookingId,
          paymentReference,
          refundReference,
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
      const { bookingId, paymentReference, refundReference, refundReason } = job.data;

      logger.error("worker.trip_refund.dlq", {
        jobId: job.id,
        bookingId,
        paymentReference,
        refundReference,
      });

      await db.transaction(async (tx) => {
        const [lockedRefund] = await tx
          .select()
          .from(refund)
          .where(eq(refund.reference, refundReference))
          .for("update")
          .limit(1);
        if (!lockedRefund) {
          logger.warn("worker.trip_refund.dlq.refund_not_found", {
            jobId: job.id,
            refundReference,
          });
          return;
        }

        // Prevents duplicate refund creation on retry: skips if a concurrent
        // retry already processed or failed this refund.
        if (lockedRefund.status !== "pending") return;

        const newRefundRef = generateReference();

        await paymentRepo.updateRefundStatus(tx, lockedRefund.id, {
          status: "failed",
          failureReason: "All 3 pg-boss retry attempts exhausted",
          completedAt: new Date(),
        });

        await paymentRepo.insertRefund(tx, {
          paymentId: lockedRefund.paymentId,
          bookingId,
          reference: newRefundRef,
          amount: lockedRefund.amount,
          currency: lockedRefund.currency,
          reason: lockedRefund.reason,
          status: "pending",
          initiatedBy: "auto",
        });

        if (bookingId) {
          await tx
            .update(booking)
            .set({ paymentStatus: "refund_failed", updatedAt: new Date() })
            .where(eq(booking.id, bookingId));
        }

        const paymentRecord = await tx.query.payment.findFirst({
          where: eq(payment.reference, paymentReference),
        });
        if (paymentRecord) {
          await paymentPayoutRefundService.sendRefundFailureEmail(paymentRecord, refundReason, lockedRefund.amount, tx);
        }
      });
    },
  );
}
