import { logger } from "../utils/logger";
import { PaymentRepository } from "../payment/payment.repository";
import { PaymentRefundService } from "../payment/payment-refund.service";
import { getStartOfTodayInRouteTimezone } from "../utils/timezone";
import { getBoss, QUEUES, type DriverDeactivationRefundJobData } from "./boss";

const paymentRepo = new PaymentRepository();
const refundService = new PaymentRefundService(paymentRepo);

export async function registerDriverDeactivationRefundWorker() {
  const boss = await getBoss();

  await boss.work<DriverDeactivationRefundJobData>(
    QUEUES.DRIVER_DEACTIVATION_REFUND,
    async ([job]) => {
      const { driverId } = job.data;

      logger.info("worker.driver_deactivation_refund.started", {
        jobId: job.id,
        driverId,
      });

      try {
        const startDate = getStartOfTodayInRouteTimezone();
        const payments = await paymentRepo
          .findSuccessfulPaymentsForDriverUpcomingTrips(driverId, startDate);

        if (payments.length === 0) {
          logger.info("worker.driver_deactivation_refund.no_payments", {
            jobId: job.id,
            driverId,
          });
          return;
        }

        let successCount = 0;
        let failCount = 0;

        for (const { payment: paymentRecord } of payments) {
          try {
            await refundService.refundConfirmedBooking(paymentRecord);
            successCount++;
          } catch (error) {
            failCount++;
            logger.error("worker.driver_deactivation_refund.payment_failed", {
              jobId: job.id,
              driverId,
              paymentReference: paymentRecord.reference,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        logger.info("worker.driver_deactivation_refund.completed", {
          jobId: job.id,
          driverId,
          total: payments.length,
          successCount,
          failCount,
        });
      } catch (error) {
        logger.error("worker.driver_deactivation_refund.failed", {
          jobId: job.id,
          driverId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  );

  await boss.work<DriverDeactivationRefundJobData>(
    QUEUES.DRIVER_DEACTIVATION_REFUND_DLQ,
    async ([job]) => {
      logger.error("worker.driver_deactivation_refund.dlq", {
        jobId: job.id,
        driverId: job.data.driverId,
      });
    },
  );
}
