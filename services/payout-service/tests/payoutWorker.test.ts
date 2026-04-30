import {
  registerFailedJobHandler,
  registerPayoutWorker,
  startPayoutWorker,
} from "@/payoutWorker";

describe("payoutWorker", () => {
  it("runs triggerPayout for each process-payout job", async () => {
    const payoutService = {
      triggerPayout: jest.fn().mockResolvedValue(undefined),
      emitFailureForPermanentPayout: jest.fn().mockResolvedValue(undefined),
    };

    registerPayoutWorker(payoutService as any);
    await startPayoutWorker();

    expect(global.mockBoss.work).toHaveBeenCalledWith(
      "process-payout",
      expect.objectContaining({
        heartbeatRefreshSeconds: 30,
        localConcurrency: 5,
        pollingIntervalSeconds: 2,
      }),
      expect.any(Function),
    );

    const handler = global.mockBoss.work.mock.calls[0][2];
    await handler([{ data: { earningId: "earning-1" } }]);

    expect(payoutService.triggerPayout).toHaveBeenCalledWith("earning-1");
  });

  it("emits failure events from the completion hook without mutating payout state again", async () => {
    const payoutService = {
      triggerPayout: jest.fn().mockResolvedValue(undefined),
      emitFailureForPermanentPayout: jest.fn().mockResolvedValue(undefined),
    };

    registerPayoutWorker(payoutService as any);
    await registerFailedJobHandler();

    expect(global.mockBoss.work).toHaveBeenCalledWith(
      "process-payout-failed",
      expect.any(Function),
    );

    const lastWorkCall =
      global.mockBoss.work.mock.calls[global.mockBoss.work.mock.calls.length - 1];
    const handler = lastWorkCall?.[1];
    expect(handler).toEqual(expect.any(Function));

    await handler?.([{ data: { earningId: "earning-1" } }]);

    expect(payoutService.emitFailureForPermanentPayout).toHaveBeenCalledWith(
      "earning-1",
    );
    expect(payoutService.triggerPayout).not.toHaveBeenCalled();
  });
});
