describe("initializePayoutService", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = "test";
  });

  it("starts the API, Kafka consumer, outbox worker, pg-boss, and payout worker without interval workers", async () => {
    const app = {
      use: jest.fn(),
      listen: jest.fn((_port: number, callback?: () => void) => {
        callback?.();
        return {
          close: jest.fn(),
        };
      }),
    };

    const expressJson = jest.fn(() => "json-middleware");
    const expressUrlencoded = jest.fn(() => "urlencoded-middleware");
    const expressFactory: any = jest.fn(() => app);
    expressFactory.json = expressJson;
    expressFactory.urlencoded = expressUrlencoded;

    const consumer = {
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
    const startPayoutConsumer = jest.fn().mockResolvedValue(consumer);
    const outboxWorker = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    };
    const createOutboxWorker = jest.fn(() => outboxWorker);
    const startBoss = jest.fn().mockResolvedValue(undefined);
    const stopBoss = jest.fn().mockResolvedValue(undefined);
    const registerPayoutWorker = jest.fn();
    const startPayoutWorker = jest.fn().mockResolvedValue(undefined);
    const registerFailedJobHandler = jest.fn().mockResolvedValue(undefined);
    const setIntervalSpy = jest.spyOn(global, "setInterval");

    jest.doMock("express", () => ({
      __esModule: true,
      default: expressFactory,
    }));
    jest.doMock("helmet", () => ({
      __esModule: true,
      default: jest.fn(() => "helmet-middleware"),
    }));
    jest.doMock("../src/payout.routes", () => ({
      __esModule: true,
      default: "payout-routes",
    }));
    jest.doMock("@shared/middleware", () => ({
      errorHandler: "error-handler",
    }));
    jest.doMock("../src/config", () => ({
      loadConfig: jest.fn(() => ({ port: 5006 })),
    }));
    jest.doMock("../src/kafka/consumer", () => ({
      startPayoutConsumer,
    }));
    jest.doMock("@shared/kafka", () => ({
      createOutboxWorker,
    }));
    jest.doMock("@shared/logger", () => ({
      logger: { info: jest.fn() },
      reportError: jest.fn(),
    }));
    jest.doMock("../db/db", () => ({
      db: {},
    }));
    jest.doMock("../db/schema", () => ({
      outboxEvents: {},
    }));
    jest.doMock("../src/queue", () => ({
      startBoss,
      stopBoss,
    }));
    jest.doMock("../src/payoutWorker", () => ({
      registerPayoutWorker,
      startPayoutWorker,
      registerFailedJobHandler,
    }));
    jest.doMock("../src/payoutService", () => ({
      PayoutService: jest.fn().mockImplementation(() => ({})),
    }));

    const { initializePayoutService } = await import("@/index");

    await initializePayoutService();

    expect(startPayoutConsumer).toHaveBeenCalledTimes(1);
    expect(createOutboxWorker).toHaveBeenCalledTimes(1);
    expect(outboxWorker.start).toHaveBeenCalledTimes(1);
    expect(startBoss).toHaveBeenCalledTimes(1);
    expect(registerPayoutWorker).toHaveBeenCalledTimes(1);
    expect(startPayoutWorker).toHaveBeenCalledTimes(1);
    expect(registerFailedJobHandler).toHaveBeenCalledTimes(1);
    expect(app.listen).toHaveBeenCalledWith(5006, expect.any(Function));
    expect(setIntervalSpy).not.toHaveBeenCalled();

    setIntervalSpy.mockRestore();
  });
});
