jest.mock("../src/pushService", () => ({
  subscribeDriver: jest.fn(),
  unsubscribeDriver: jest.fn(),
  getVapidPublicKey: jest.fn().mockReturnValue("test-vapid-public-key"),
}));

const mockGetDriverIdForUser = jest.fn();

jest.mock("../src/notificationService", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    getDriverIdForUser: mockGetDriverIdForUser,
  })),
}));

import type { Request, Response } from "express";
import { createServiceError } from "@shared/utils";
import { subscribeHandler, unsubscribeHandler } from "../src/push.controller";
import { subscribeDriver, unsubscribeDriver } from "../src/pushService";

function createResponseMock() {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return response as unknown as Response;
}

describe("push.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("subscribes using the resolved driver identity, not the auth user id", async () => {
    mockGetDriverIdForUser.mockResolvedValue("driver-1");

    const req = {
      user: {
        userId: "user-1",
        email: "driver@example.com",
        emailVerified: true,
        role: "driver",
      },
      body: {
        endpoint: "https://push.example/subscription",
        p256dh: "p256dh-value",
        auth: "auth-value",
      },
    } as unknown as Request;
    const res = createResponseMock();

    await subscribeHandler(req, res);

    expect(mockGetDriverIdForUser).toHaveBeenCalledWith(req.user);
    expect(subscribeDriver).toHaveBeenCalledWith({
      driverId: "driver-1",
      endpoint: "https://push.example/subscription",
      p256dh: "p256dh-value",
      auth: "auth-value",
    });
  });

  it("unsubscribes using the resolved driver identity, not the auth user id", async () => {
    mockGetDriverIdForUser.mockResolvedValue("driver-1");

    const req = {
      user: {
        userId: "user-1",
        email: "driver@example.com",
        emailVerified: true,
        role: "driver",
      },
      body: {
        endpoint: "https://push.example/subscription",
      },
    } as unknown as Request;
    const res = createResponseMock();

    await unsubscribeHandler(req, res);

    expect(mockGetDriverIdForUser).toHaveBeenCalledWith(req.user);
    expect(unsubscribeDriver).toHaveBeenCalledWith(
      "driver-1",
      "https://push.example/subscription",
    );
  });

  it("returns the driver identity error status when the projection is missing", async () => {
    mockGetDriverIdForUser.mockRejectedValue(
      createServiceError("Driver identity not found", 404),
    );

    const req = {
      user: {
        userId: "user-1",
        email: "driver@example.com",
        emailVerified: true,
        role: "driver",
      },
      body: {
        endpoint: "https://push.example/subscription",
        p256dh: "p256dh-value",
        auth: "auth-value",
      },
    } as unknown as Request;
    const res = createResponseMock();

    await subscribeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Driver identity not found",
      }),
    );
  });
});
