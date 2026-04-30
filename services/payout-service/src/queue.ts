import { PgBoss } from "pg-boss";
import { loadConfig } from "./config";
import { logger } from "@shared/logger";
import { sentryServer } from "@shared/sentry";

const config = loadConfig();
const PAYOUT_QUEUE = "process-payout";
const PAYOUT_DLQ = "process-payout-failed";
const PAYOUT_QUEUE_OPTIONS = {
  policy: "exclusive" as const,
  heartbeatSeconds: 60,
  expireInSeconds: config.payoutJobExpireMinutes * 60,
  deleteAfterSeconds: 30 * 24 * 60 * 60,
  deadLetter: PAYOUT_DLQ,
  retryLimit: 0,
};

export const boss = new PgBoss(process.env.DATABASE_URL!);

// Must be registered before boss.start() to catch any errors during startup
boss.on("error", (err) => {
  sentryServer.captureException(err, "unknown", {
    action: "pgboss_error",
  });
  logger.error("pgboss_internal_error", { error: err.message });
});

async function setupPayoutQueue(): Promise<void> {
  // DLQ must exist before the main queue can reference it as a dead letter target
  const existingDlq = await boss.getQueue(PAYOUT_DLQ);
  if (!existingDlq) {
    await boss.createQueue(PAYOUT_DLQ, {
      deleteAfterSeconds: 30 * 24 * 60 * 60,
    });
  } else {
    await boss.updateQueue(PAYOUT_DLQ, {
      deleteAfterSeconds: 30 * 24 * 60 * 60,
    });
  }

  const existingQueue = await boss.getQueue(PAYOUT_QUEUE);
  if (!existingQueue) {
    await boss.createQueue(PAYOUT_QUEUE, PAYOUT_QUEUE_OPTIONS);
  } else {
    if (existingQueue.policy !== PAYOUT_QUEUE_OPTIONS.policy) {
      throw new Error(
        `Queue ${PAYOUT_QUEUE} must use ${PAYOUT_QUEUE_OPTIONS.policy} policy, found ${existingQueue.policy || "standard"}`,
      );
    }

    await boss.updateQueue(PAYOUT_QUEUE, {
      heartbeatSeconds: PAYOUT_QUEUE_OPTIONS.heartbeatSeconds,
      expireInSeconds: PAYOUT_QUEUE_OPTIONS.expireInSeconds,
      deleteAfterSeconds: PAYOUT_QUEUE_OPTIONS.deleteAfterSeconds,
      deadLetter: PAYOUT_QUEUE_OPTIONS.deadLetter,
      retryLimit: PAYOUT_QUEUE_OPTIONS.retryLimit,
    });
  }
}

export async function startBoss(): Promise<void> {
  await boss.start();
  await setupPayoutQueue();
}

export async function stopBoss(): Promise<void> {
  await boss.stop();
}
