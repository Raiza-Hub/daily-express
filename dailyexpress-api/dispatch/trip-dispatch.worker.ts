import { logger } from "../utils/logger";
import { getBoss, QUEUES, type TripDispatchJobData } from "../workers/boss";
import { tripDispatchService } from "./trip-dispatch.service";

export async function registerTripDispatchWorker() {
  const boss = await getBoss();

  await boss.work<TripDispatchJobData>(
    QUEUES.TRIP_DISPATCH,
    { batchSize: 1, localConcurrency: 5, pollingIntervalSeconds: 2 },
    async ([job]) => {
      logger.info("worker.trip_dispatch.started", {
        jobId: job.id,
        tripId: job.data.tripId,
        action: job.data.action,
      });
      await tripDispatchService.processJob(job.data);
    },
  );

  await boss.work<TripDispatchJobData>(
    QUEUES.TRIP_DISPATCH_DLQ,
    async ([job]) => {
      logger.error("worker.trip_dispatch.dlq", {
        jobId: job.id,
        tripId: job.data.tripId,
        action: job.data.action,
      });
    },
  );
}
