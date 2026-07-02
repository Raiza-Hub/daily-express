import { logger } from "../utils/logger";
import { AllocationService } from "../route/allocation.service";
import { routeRepository } from "../route/route.repository";
import { getBoss, QUEUES, type AllocationJobData } from "./boss";

const allocationService = new AllocationService(routeRepository);

export async function registerAllocationWorker() {
  const boss = await getBoss();

  await boss.work<AllocationJobData>(
    QUEUES.ALLOCATION_PROCESS,
    {
      batchSize: 1,
      localConcurrency: 5,
      pollingIntervalSeconds: 1,
      heartbeatRefreshSeconds: 30,
    },
    async ([job]) => {
      logger.info("worker.allocation.started", {
        jobId: job.id,
        bookingId: job.data.bookingId,
        reference: job.data.reference,
      });

      try {
        await allocationService.allocateBooking(
          job.data.bookingId,
          job.data.reference,
        );
      } catch (error) {
        logger.error("worker.allocation.failed", {
          jobId: job.id,
          bookingId: job.data.bookingId,
          reference: job.data.reference,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  );
}
