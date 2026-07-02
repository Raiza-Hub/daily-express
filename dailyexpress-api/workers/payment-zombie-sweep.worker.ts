import { paymentZombieSweeperService } from "../payment/payment-zombie-sweeper.service";
import { logger } from "../utils/logger";
import { getBoss } from "./boss";

export async function registerPaymentZombieSweepWorker() {
  const boss = await getBoss();

  await boss.schedule("payment.zombie_sweep", "*/5 * * * *", null, {
    singletonKey: "payment-zombie-sweep",
    tz: "Africa/Lagos",
  });

  await boss.work("payment.zombie_sweep", { batchSize: 1 }, async ([job]) => {
    logger.info("worker.payment_zombie_sweep.started", { jobId: job.id });

    try {
      const result = await paymentZombieSweeperService.sweep();
      logger.info("worker.payment_zombie_sweep.completed", {
        jobId: job.id,
        scanned: result.scanned,
        reconciled: result.reconciled,
        stillPending: result.stillPending,
        koraErrors: result.koraErrors,
        koraNotFound: result.koraNotFound,
      });
    } catch (error) {
      logger.error("worker.payment_zombie_sweep.failed", {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
