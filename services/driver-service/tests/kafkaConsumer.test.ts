const mockKafkaLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock("@shared/kafka", () => ({
  createConsumer: jest.fn(),
  decodeEvent: jest.fn(),
  TOPICS: {
    USER_ACCOUNT_DELETED: "user.account.deleted",
    BOOKING_CONFIRMED: "booking.confirmed",
    PAYOUT_COMPLETED: "payout.completed",
    DRIVER_BANK_VERIFIED: "driver.bank.verified",
    DRIVER_BANK_VERIFICATION_FAILED: "driver.bank.verification.failed",
    ROUTE_CREATED: "route.created",
    ROUTE_DELETED: "route.deleted",
  },
}));

jest.mock("@shared/logger", () => ({
  logger: {
    child: jest.fn(() => mockKafkaLogger),
  },
  reportError: jest.fn(),
}));

import { decodeEvent } from "@shared/kafka";
import { emitDriverPayoutProfileDeleted } from "../src/kafka/producer";
import {
  handleRouteDeleted,
  handleUserAccountDeleted,
} from "../src/kafka/consumer";
import { testDriver } from "./setup";
import { driver, driverStats } from "../db/schema";

const mockedDecodeEvent = decodeEvent as jest.MockedFunction<
  typeof decodeEvent
>;
const mockedEmitDriverPayoutProfileDeleted =
  emitDriverPayoutProfileDeleted as jest.MockedFunction<
    typeof emitDriverPayoutProfileDeleted
  >;

describe("driver kafka consumer", () => {
  it("deletes driver stats when a user account deletion event is processed", async () => {
    mockedDecodeEvent.mockResolvedValue({
      payload: {
        userId: testDriver.userId,
      },
    } as any);

    (global.mockDrizzle.query.driver.findFirst as jest.Mock).mockResolvedValue(
      testDriver,
    );

    const mockDeleteWhere = jest.fn().mockResolvedValue({});
    (global.mockDrizzle.delete as jest.Mock).mockReturnValue({
      where: mockDeleteWhere,
    });

    await handleUserAccountDeleted(Buffer.from("event"));

    expect(global.mockDrizzle.query.driver.findFirst).toHaveBeenCalledWith({
      where: expect.anything(),
    });
    expect(global.mockDrizzle.transaction).toHaveBeenCalledTimes(1);
    expect(global.mockDrizzle.delete).toHaveBeenNthCalledWith(1, driverStats);
    expect(global.mockDrizzle.delete).toHaveBeenNthCalledWith(2, driver);
    expect(mockDeleteWhere).toHaveBeenCalledTimes(2);
    expect(mockedEmitDriverPayoutProfileDeleted).toHaveBeenCalledWith({
      driverId: testDriver.id,
      userId: testDriver.userId,
    });
  });

  it("decrements active routes when a route deleted event is processed", async () => {
    (
      global.mockDrizzle.query.driverStats.findFirst as jest.Mock
    ).mockResolvedValue({
      id: "stats-id",
      driverId: testDriver.id,
      totalEarnings: 0,
      pendingPayments: 0,
      totalPassengers: 0,
      activeRoutes: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockSet = jest.fn().mockReturnThis();
    const mockWhere = jest.fn().mockResolvedValue({});
    (global.mockDrizzle.update as jest.Mock).mockReturnValue({
      set: mockSet,
      where: mockWhere,
    });

    await handleRouteDeleted({
      eventId: "evt-route-deleted",
      eventType: "route.deleted",
      eventVersion: 1,
      occurredAt: "2025-07-01T00:00:00.000Z",
      source: "route-service",
      payload: {
        routeId: "route-id-1",
        driverId: testDriver.id,
      },
    } as any);

    expect(global.mockDrizzle.query.driverStats.findFirst).toHaveBeenCalledWith(
      {
        where: expect.anything(),
      },
    );
    expect(mockSet).toHaveBeenCalledWith({
      activeRoutes: 0,
      updatedAt: expect.any(Date),
    });
    expect(mockWhere).toHaveBeenCalledWith(expect.anything());
    expect(mockKafkaLogger.warn).not.toHaveBeenCalled();
  });

  it("no-ops when driver stats are missing for a deleted route", async () => {
    (
      global.mockDrizzle.query.driverStats.findFirst as jest.Mock
    ).mockResolvedValue(null);

    const mockSet = jest.fn();
    const mockWhere = jest.fn();
    (global.mockDrizzle.update as jest.Mock).mockReturnValue({
      set: mockSet,
      where: mockWhere,
    });

    await expect(
      handleRouteDeleted({
        eventId: "evt-route-deleted",
        eventType: "route.deleted",
        eventVersion: 1,
        occurredAt: "2025-07-01T00:00:00.000Z",
        source: "route-service",
        payload: {
          routeId: "route-id-1",
          driverId: testDriver.id,
        },
      } as any),
    ).resolves.toBeUndefined();

    expect(global.mockDrizzle.update).not.toHaveBeenCalled();
    expect(mockKafkaLogger.warn).toHaveBeenCalledWith(
      "driver.stats_missing",
      expect.objectContaining({
        driver_id: testDriver.id,
        reason: "route_deleted",
      }),
    );
  });
});
