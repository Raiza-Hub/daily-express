import { logger } from "../utils/logger";
import { PayoutService } from "../payout/payoutService";
import { getBoss, QUEUES, type PayoutProcessJobData } from "./boss";

const payoutService = new PayoutService();

export async function registerPayoutWorker() {
  const boss = await getBoss();

  await boss.work<PayoutProcessJobData>(
    QUEUES.PAYOUT_PROCESS,
    {
      localConcurrency: 5,
      pollingIntervalSeconds: 2,
      heartbeatRefreshSeconds: 30,
    },
    async ([job]) => {
      logger.info("worker.payout.started", {
        jobId: job.id,
        earningId: job.data.earningId,
      });

      await payoutService.triggerPayout(job.data.earningId);

      logger.info("worker.payout.completed", {
        jobId: job.id,
        earningId: job.data.earningId,
      });
    },
  );
}
