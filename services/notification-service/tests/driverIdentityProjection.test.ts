import { NotificationService } from "../src/notificationService";

describe("NotificationService driver identity projection", () => {
  const service = new NotificationService();

  beforeEach(() => {
    jest.clearAllMocks();
    global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);
  });

  it("stores a driver identity projection from Kafka", async () => {
    global.mockDrizzle.query.driverIdentity.findFirst.mockResolvedValue(null);

    const insertIdentity = {
      values: jest.fn().mockReturnThis(),
    };
    const insertConsumed = {
      values: jest.fn().mockReturnThis(),
    };

    global.mockDrizzle.insert
      .mockReturnValueOnce(insertIdentity)
      .mockReturnValueOnce(insertConsumed);

    await service.handleDriverIdentityCreated(
      {
        eventId: "evt-driver-created",
        eventType: "driver.identity.created",
        eventVersion: 1,
        occurredAt: "2025-07-01T00:00:00.000Z",
        source: "driver-service",
        payload: {
          driverId: "driver-1",
          userId: "user-1",
          firstName: "Tunde",
          lastName: "Driver",
          email: "driver@example.com",
          phone: "08000000000",
          country: "Nigeria",
          state: "Lagos",
          city: "Ikeja",
          currency: "NGN",
          isActive: true,
        },
      },
      "driver.identity.created",
    );

    expect(insertIdentity.values).toHaveBeenCalledWith(
      expect.objectContaining({
        driverId: "driver-1",
        userId: "user-1",
        sourceOccurredAt: new Date("2025-07-01T00:00:00.000Z"),
      }),
    );
    expect(insertConsumed.values).toHaveBeenCalledWith({
      eventId: "evt-driver-created",
      topic: "driver.identity.created",
    });
  });

  it("updates the mapping when a newer driver identity update arrives", async () => {
    global.mockDrizzle.query.driverIdentity.findFirst.mockResolvedValue({
      driverId: "driver-1",
      userId: "user-1",
      sourceOccurredAt: new Date("2025-07-01T00:00:00.000Z"),
    });

    const updateChain = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };
    const insertConsumed = {
      values: jest.fn().mockReturnThis(),
    };

    global.mockDrizzle.update.mockReturnValue(updateChain);
    global.mockDrizzle.insert.mockReturnValue(insertConsumed);

    await service.handleDriverIdentityUpdated(
      {
        eventId: "evt-driver-updated",
        eventType: "driver.identity.updated",
        eventVersion: 1,
        occurredAt: "2025-07-02T00:00:00.000Z",
        source: "driver-service",
        payload: {
          driverId: "driver-1",
          userId: "user-1",
          firstName: "Tunde",
          lastName: "Driver",
          email: "driver@example.com",
          phone: "08000000000",
          country: "Nigeria",
          state: "Lagos",
          city: "Ikeja",
          currency: "NGN",
          isActive: true,
        },
      },
      "driver.identity.updated",
    );

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceOccurredAt: new Date("2025-07-02T00:00:00.000Z"),
      }),
    );
    expect(insertConsumed.values).toHaveBeenCalledWith({
      eventId: "evt-driver-updated",
      topic: "driver.identity.updated",
    });
  });

  it("removes the mapping when a newer delete arrives", async () => {
    global.mockDrizzle.query.driverIdentity.findFirst.mockResolvedValue({
      driverId: "driver-1",
      userId: "user-1",
      sourceOccurredAt: new Date("2025-07-01T00:00:00.000Z"),
    });

    const deleteChain = {
      where: jest.fn().mockReturnThis(),
    };
    const insertConsumed = {
      values: jest.fn().mockReturnThis(),
    };

    global.mockDrizzle.delete.mockReturnValue(deleteChain);
    global.mockDrizzle.insert.mockReturnValue(insertConsumed);

    await service.handleDriverIdentityDeleted(
      {
        eventId: "evt-driver-deleted",
        eventType: "driver.identity.deleted",
        eventVersion: 1,
        occurredAt: "2025-07-02T00:00:00.000Z",
        source: "driver-service",
        payload: {
          driverId: "driver-1",
          userId: "user-1",
        },
      },
      "driver.identity.deleted",
    );

    expect(deleteChain.where).toHaveBeenCalled();
    expect(insertConsumed.values).toHaveBeenCalledWith({
      eventId: "evt-driver-deleted",
      topic: "driver.identity.deleted",
    });
  });
});
