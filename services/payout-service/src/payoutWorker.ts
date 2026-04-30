import { boss } from "./queue";
import { PayoutService } from "./payoutService";
import { sentryServer } from "@shared/sentry";

let payoutService: PayoutService | null = null;

type PayoutJobData = {
  earningId: string;
};


export function registerPayoutWorker(ps: PayoutService): void {
  payoutService = ps;
}

export async function startPayoutWorker(): Promise<void> {
  if (!payoutService) {
    throw new Error("PayoutService not registered");
  }

  const registeredPayoutService = payoutService;

  await boss.work<PayoutJobData>(
    "process-payout",
    {
      localConcurrency: 5,
      pollingIntervalSeconds: 2,
      heartbeatRefreshSeconds: 30,
    },
    async ([job]) => {
      if (!job) {
        return;
      }

      await registeredPayoutService.triggerPayout(job.data.earningId);
    },
  );
}

export async function registerFailedJobHandler(): Promise<void> {
  await boss.work<PayoutJobData>(
    "process-payout-failed",
    async ([job]) => {
      if (!job || !payoutService) return;

      const { earningId } = job.data;

      try {
        await payoutService.emitFailureForPermanentPayout(earningId);
      } catch (err) {
        sentryServer.captureException(err, "unknown", {
          action: "registerFailedJobHandler",
          values: { earningId },
        });
        console.error("Failed job handler error:", err);
      }
    },
  );
}
