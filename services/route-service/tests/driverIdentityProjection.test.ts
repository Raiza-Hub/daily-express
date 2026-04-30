import { RouteService } from "@/routeService";
import { testDriverIdentity } from "./setup";

describe("RouteService driver identity projection", () => {
  const routeService = new RouteService();

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

    await routeService.handleDriverIdentityCreated(
      {
        eventId: "evt-driver-created",
        eventType: "driver.identity.created",
        eventVersion: 1,
        occurredAt: "2025-07-01T00:00:00.000Z",
        source: "driver-service",
        payload: {
          driverId: testDriverIdentity.driverId,
          userId: testDriverIdentity.userId,
          firstName: testDriverIdentity.firstName,
          lastName: testDriverIdentity.lastName,
          email: "driver@example.com",
          phone: testDriverIdentity.phone,
          country: testDriverIdentity.country,
          state: testDriverIdentity.state,
          city: "Ikeja",
          currency: "NGN",
          isActive: testDriverIdentity.isActive,
          profilePictureUrl: testDriverIdentity.profilePictureUrl,
        },
      },
      "driver.identity.created",
    );

    expect(insertIdentity.values).toHaveBeenCalledWith(
      expect.objectContaining({
        driverId: testDriverIdentity.driverId,
        userId: testDriverIdentity.userId,
        sourceOccurredAt: new Date("2025-07-01T00:00:00.000Z"),
      }),
    );
    expect(insertConsumed.values).toHaveBeenCalledWith({
      eventId: "evt-driver-created",
      topic: "driver.identity.created",
    });
  });

  it("ignores stale driver identity updates", async () => {
    global.mockDrizzle.query.driverIdentity.findFirst.mockResolvedValue({
      ...testDriverIdentity,
      sourceOccurredAt: new Date("2025-07-02T00:00:00.000Z"),
    });

    const insertConsumed = {
      values: jest.fn().mockReturnThis(),
    };
    global.mockDrizzle.insert.mockReturnValue(insertConsumed);

    await routeService.handleDriverIdentityUpdated(
      {
        eventId: "evt-driver-updated",
        eventType: "driver.identity.updated",
        eventVersion: 1,
        occurredAt: "2025-07-01T00:00:00.000Z",
        source: "driver-service",
        payload: {
          driverId: testDriverIdentity.driverId,
          userId: testDriverIdentity.userId,
          firstName: "Older",
          lastName: "Driver",
          email: "driver@example.com",
          phone: testDriverIdentity.phone,
          country: testDriverIdentity.country,
          state: testDriverIdentity.state,
          city: "Ikeja",
          currency: "NGN",
          isActive: testDriverIdentity.isActive,
          profilePictureUrl: testDriverIdentity.profilePictureUrl,
        },
      },
      "driver.identity.updated",
    );

    expect(global.mockDrizzle.update).not.toHaveBeenCalled();
    expect(global.mockDrizzle.delete).not.toHaveBeenCalled();
    expect(insertConsumed.values).toHaveBeenCalledWith({
      eventId: "evt-driver-updated",
      topic: "driver.identity.updated",
    });
  });

  it("removes a driver identity projection when a newer delete arrives", async () => {
    global.mockDrizzle.query.driverIdentity.findFirst.mockResolvedValue(
      testDriverIdentity,
    );

    const deleteChain = {
      where: jest.fn().mockReturnThis(),
    };
    const insertConsumed = {
      values: jest.fn().mockReturnThis(),
    };

    global.mockDrizzle.delete.mockReturnValue(deleteChain);
    global.mockDrizzle.insert.mockReturnValue(insertConsumed);

    await routeService.handleDriverIdentityDeleted(
      {
        eventId: "evt-driver-deleted",
        eventType: "driver.identity.deleted",
        eventVersion: 1,
        occurredAt: "2025-07-02T00:00:00.000Z",
        source: "driver-service",
        payload: {
          driverId: testDriverIdentity.driverId,
          userId: testDriverIdentity.userId,
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
