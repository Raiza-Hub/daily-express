import {
  sendPushNotification,
  subscribeDriver,
  unsubscribeDriver,
} from "../src/pushService";

describe("pushService", () => {
  it("upserts push subscriptions for a driver endpoint", async () => {
    await subscribeDriver({
      driverId: "driver-1",
      endpoint: "https://push.example/subscription",
      p256dh: "p256dh-value",
      auth: "auth-value",
    });

    expect(global.mockDrizzle.insert).toHaveBeenCalledTimes(1);
    expect(global.mockNotificationValues).toHaveBeenCalledWith(
      expect.objectContaining({
        driverId: "driver-1",
        endpoint: "https://push.example/subscription",
        p256dh: "p256dh-value",
        auth: "auth-value",
      }),
    );
    expect(global.mockNotificationInsertConflict.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.any(Array),
        set: expect.objectContaining({
          p256dh: "p256dh-value",
          auth: "auth-value",
        }),
      }),
    );
  });

  it("removes expired subscriptions after a 410 response", async () => {
    global.mockDrizzle.select.mockReturnValue({
      from: jest.fn(() => ({
        where: jest.fn().mockResolvedValue([
          {
            endpoint: "https://push.example/subscription",
            p256dh: "p256dh-value",
            auth: "auth-value",
          },
        ]),
      })),
    } as any);

    const deleteWhere = jest.fn().mockResolvedValue(undefined);
    global.mockDrizzle.delete.mockReturnValue({
      where: deleteWhere,
    } as any);

    global.mockWebPush.sendNotification.mockRejectedValue({
      statusCode: 410,
    });

    const result = await sendPushNotification("driver-1", {
      title: "Test notification",
      message: "A notification body",
      tag: "Test",
    });

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(deleteWhere).toHaveBeenCalled();
  });

  it("keeps subscriptions after a transient push failure", async () => {
    global.mockDrizzle.select.mockReturnValue({
      from: jest.fn(() => ({
        where: jest.fn().mockResolvedValue([
          {
            endpoint: "https://push.example/subscription",
            p256dh: "p256dh-value",
            auth: "auth-value",
          },
        ]),
      })),
    } as any);

    const deleteWhere = jest.fn().mockResolvedValue(undefined);
    global.mockDrizzle.delete.mockReturnValue({
      where: deleteWhere,
    } as any);

    global.mockWebPush.sendNotification.mockRejectedValue({
      statusCode: 503,
    });

    const result = await sendPushNotification("driver-1", {
      title: "Test notification",
      message: "A notification body",
      tag: "Test",
    });

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(deleteWhere).not.toHaveBeenCalled();
  });

  it("deletes a subscription by driver and endpoint", async () => {
    const deleteWhere = jest.fn().mockResolvedValue(undefined);
    global.mockDrizzle.delete.mockReturnValue({
      where: deleteWhere,
    } as any);

    await unsubscribeDriver("driver-1", "https://push.example/subscription");

    expect(global.mockDrizzle.delete).toHaveBeenCalledTimes(1);
    expect(deleteWhere).toHaveBeenCalled();
  });
});
