import { and, desc, eq } from "drizzle-orm";
import { logger } from "../utils/logger";
import { db } from "../db/connection";
import { booking, payment, refund } from "../db/index";
import { paymentRepository } from "../payment/payment.repository";
import { paymentService } from "../payment/payment.service";
import { generateReference } from "../utils/payment";
import { getBoss, QUEUES, type PaymentExpireJobData } from "./boss";

const paymentRepo = paymentRepository;

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
      const { reference, bookingId } = job.data;

      logger.error("worker.payment_expiry.dlq", {
        jobId: job.id,
        bookingId,
        reference,
      });

      // Prevents refund cascade on retry: a previous retry may have already
      // created a new pending refund. orderBy picks the latest one.
      await db.transaction(async (tx) => {
        const [lockedPayment] = await tx
          .select()
          .from(payment)
          .where(eq(payment.reference, reference))
          .for("update")
          .limit(1);
        if (!lockedPayment) return;

        const pendingRefund = await tx.query.refund.findFirst({
          where: and(
            eq(refund.paymentId, lockedPayment.id),
            eq(refund.status, "pending"),
          ),
          orderBy: (ref, { desc: _desc }) => [_desc(ref.createdAt)],
        });
        if (!pendingRefund) return;

        const newRefundRef = generateReference();

        await paymentRepo.updateRefundStatus(tx, pendingRefund.id, {
          status: "failed",
          failureReason: "All 3 expiry+refund retry attempts exhausted",
          completedAt: new Date(),
        });

        await paymentRepo.insertRefund(tx, {
          paymentId: lockedPayment.id,
          bookingId,
          reference: newRefundRef,
          amount: pendingRefund.amount,
          currency: pendingRefund.currency,
          reason: pendingRefund.reason,
          status: "pending",
          initiatedBy: "auto",
        });

        if (bookingId) {
          await tx
            .update(booking)
            .set({ paymentStatus: "refund_failed", updatedAt: new Date() })
            .where(eq(booking.id, bookingId));
        }
      });
    },
  );
}
