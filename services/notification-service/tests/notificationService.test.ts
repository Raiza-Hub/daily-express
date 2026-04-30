import { NotificationService } from "../src/notificationService";

describe("NotificationService", () => {
  const testUser = {
    userId: "user-1",
    email: "driver@example.com",
    emailVerified: true,
    role: "driver",
  } as const;

  it("creates a payout completion notification from a Kafka event", async () => {
    global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);

    const service = new NotificationService();

    await service.handlePayoutCompleted(
      {
        eventId: "evt-1",
        eventType: "payout.completed",
        eventVersion: 1,
        occurredAt: "2025-01-01T00:00:00.000Z",
        source: "payout-service",
        payload: {
          payoutId: "payout-1",
          driverId: "driver-1",
          reference: "DX-PO-1",
          amountMinor: 125000,
          currency: "NGN",
        },
      },
      "payout.completed",
    );

    expect(global.mockDrizzle.insert).toHaveBeenCalledTimes(2);
    expect(global.mockNotificationValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        driverId: "driver-1",
        notificationKey: "event:evt-1",
        kind: "event",
        type: "payout_completed",
        title: "Payout sent successfully",
        href: "/payouts",
        tag: "Paid",
        tone: "positive",
      }),
    );
    expect(global.mockNotificationValues).toHaveBeenNthCalledWith(2, {
      eventId: "evt-1",
      topic: "payout.completed",
    });
    expect(global.mockBossModule.enqueueDispatchNotificationJob).toHaveBeenCalled();
  });

  it("does not re-dispatch delivery when an event was already consumed", async () => {
    global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue({
      eventId: "evt-1",
    });
    global.mockDrizzle.query.notification.findFirst.mockResolvedValue({
      id: "notif-1",
      driverId: "driver-1",
      notificationKey: "event:evt-1",
      kind: "event",
      type: "payout_completed",
      title: "Payout sent successfully",
      message: "Already delivered.",
      href: "/payouts",
      tag: "Paid",
      tone: "positive",
      metadata: null,
      contentHash: "hash",
      occurredAt: new Date("2025-01-01T00:00:00.000Z"),
      readAt: null,
      archivedAt: null,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    } as any);

    const service = new NotificationService();

    await service.handlePayoutCompleted(
      {
        eventId: "evt-1",
        eventType: "payout.completed",
        eventVersion: 1,
        occurredAt: "2025-01-01T00:00:00.000Z",
        source: "payout-service",
        payload: {
          payoutId: "payout-1",
          driverId: "driver-1",
          reference: "DX-PO-1",
          amountMinor: 125000,
          currency: "NGN",
        },
      },
      "payout.completed",
    );

    expect(global.mockBossModule.enqueueDispatchNotificationJob).not.toHaveBeenCalled();
  });

  describe("handleBookingConfirmed", () => {
    it("should create booking confirmed notification", async () => {
      global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);
      const service = new NotificationService();
      const formattedDate = new Intl.DateTimeFormat("en-NG", {
        month: "short",
        day: "numeric",
      }).format(new Date("2025-01-15T00:00:00.000Z"));

      await service.handleBookingConfirmed(
        {
          eventId: "evt-book-1",
          eventType: "booking.confirmed",
          eventVersion: 1,
          occurredAt: "2025-01-01T00:00:00.000Z",
          source: "route-service",
          payload: {
            bookingId: "booking-1",
            tripId: "trip-1",
            routeId: "route-1",
            driverId: "driver-1",
            userId: "user-1",
            passengerName: "Ada Obi",
            pickupTitle: "Lagos",
            dropoffTitle: "Ibadan",
            seatNumber: 3,
            fareAmountMinor: 5000,
            currency: "NGN",
            paymentReference: "pay-ref-1",
            tripDate: "2025-01-15T00:00:00.000Z",
            departureTime: "2025-01-15T08:00:00.000Z",
          },
        },
        "booking.confirmed",
      );

      expect(global.mockDrizzle.insert).toHaveBeenCalledTimes(2);
      expect(global.mockNotificationValues).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          driverId: "driver-1",
          kind: "event",
          type: "booking_confirmed",
          title: "New booking confirmed",
          message: `This trip was booked by Ada Obi for ${formattedDate}.`,
        }),
      );
    });

    it("should fall back when passengerName is unavailable", async () => {
      global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);
      const service = new NotificationService();
      const formattedDate = new Intl.DateTimeFormat("en-NG", {
        month: "short",
        day: "numeric",
      }).format(new Date("2025-01-15T00:00:00.000Z"));

      await service.handleBookingConfirmed(
        {
          eventId: "evt-book-2",
          eventType: "booking.confirmed",
          eventVersion: 1,
          occurredAt: "2025-01-01T00:00:00.000Z",
          source: "route-service",
          payload: {
            bookingId: "booking-2",
            tripId: "trip-2",
            routeId: "route-2",
            driverId: "driver-2",
            userId: "user-2",
            passengerName: null,
            pickupTitle: "Lagos",
            dropoffTitle: "Ibadan",
            seatNumber: 2,
            fareAmountMinor: 5000,
            currency: "NGN",
            paymentReference: "pay-ref-2",
            tripDate: "2025-01-15T00:00:00.000Z",
            departureTime: "2025-01-15T08:00:00.000Z",
          },
        },
        "booking.confirmed",
      );

      expect(global.mockNotificationValues).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          driverId: "driver-2",
          type: "booking_confirmed",
          message: `This trip was booked for ${formattedDate}.`,
        }),
      );
    });
  });

  describe("handleTripCompleted", () => {
    it("should create trip completed notification", async () => {
      global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);
      const service = new NotificationService();
      const formattedDate = new Intl.DateTimeFormat("en-NG", {
        month: "short",
        day: "numeric",
      }).format(new Date("2025-01-09T00:00:00.000Z"));

      await service.handleTripCompleted(
        {
          eventId: "evt-trip-1",
          eventType: "trip.completed",
          eventVersion: 1,
          occurredAt: "2025-01-01T00:00:00.000Z",
          source: "route-service",
          payload: {
            tripId: "trip-1",
            driverId: "driver-1",
            pickupTitle: "Lagos",
            dropoffTitle: "Ibadan",
            tripDate: "2025-01-09T00:00:00.000Z",
            completedAt: "2025-01-01T12:00:00.000Z",
          },
        },
        "trip.completed",
      );

      expect(global.mockDrizzle.insert).toHaveBeenCalledTimes(2);
      expect(global.mockNotificationValues).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          driverId: "driver-1",
          kind: "event",
          type: "trip_completed",
          title: "Trip completed",
          message: `Lagos -> Ibadan for ${formattedDate} is completed.`,
        }),
      );
    });
  });

  describe("getNotifications", () => {
    it("uses local driver identity when available", async () => {
      const service = new NotificationService();

      global.mockDrizzle.query.driverIdentity.findFirst.mockResolvedValue({
        driverId: "driver-1",
        userId: "user-1",
      });
      global.mockDrizzle.query.notification.findMany.mockResolvedValue([]);

      const result = await service.getNotifications(testUser, {
        limit: 10,
      });

      expect(result.notifications).toEqual([]);
    });

    it("returns stored notifications for the driver", async () => {
      const service = new NotificationService();

      global.mockDrizzle.query.driverIdentity.findFirst.mockResolvedValue({
        driverId: "driver-1",
        userId: "user-1",
      });
      global.mockDrizzle.query.notification.findMany.mockResolvedValue([
        {
          id: "notif-1",
          driverId: "driver-1",
          notificationKey: "event:evt-1",
          kind: "event",
          type: "booking_confirmed",
          title: "New booking confirmed",
          message: "A booking was confirmed.",
          href: "/routes",
          tag: "Booking",
          tone: "positive",
          metadata: null,
          contentHash: "hash",
          occurredAt: new Date("2025-04-09T00:00:00.000Z"),
          readAt: null,
          archivedAt: null,
          createdAt: new Date("2025-04-09T00:00:00.000Z"),
          updatedAt: new Date("2025-04-09T00:00:00.000Z"),
        },
      ] as any);

      const result = await service.getNotifications(testUser, {
        limit: 10,
      });

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.notificationKey).toBe("event:evt-1");
    });

    it("fails when the driver identity projection is missing", async () => {
      const service = new NotificationService();

      global.mockDrizzle.query.driverIdentity.findFirst.mockResolvedValue(null);

      await expect(service.getNotifications(testUser)).rejects.toMatchObject({
        statusCode: 404,
        message: "Driver identity not found",
      });
    });
  });

  describe("handleDriverIdentityCreated", () => {
    it("stores the driver identity projection from Kafka", async () => {
      global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);

      const service = new NotificationService();

      await service.handleDriverIdentityCreated(
        {
          eventId: "evt-driver-1",
          eventType: "driver.identity.created",
          eventVersion: 1,
          occurredAt: "2025-01-01T00:00:00.000Z",
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

      expect(global.mockNotificationValues).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          driverId: "driver-1",
          userId: "user-1",
        }),
      );
      expect(global.mockNotificationValues).toHaveBeenNthCalledWith(2, {
        eventId: "evt-driver-1",
        topic: "driver.identity.created",
      });
    });
  });

  describe("handleTripCancelled", () => {
    it("should create trip cancelled notification", async () => {
      global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);
      const service = new NotificationService();

      await service.handleTripCancelled(
        {
          eventId: "evt-tripcancel-1",
          eventType: "trip.cancelled",
          eventVersion: 1,
          occurredAt: "2025-01-01T00:00:00.000Z",
          source: "route-service",
          payload: {
            tripId: "trip-1",
            driverId: "driver-1",
            cancelledAt: "2025-01-01T12:00:00.000Z",
          },
        },
        "trip.cancelled",
      );

      expect(global.mockDrizzle.insert).toHaveBeenCalledTimes(2);
      expect(global.mockNotificationValues).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          driverId: "driver-1",
          kind: "event",
          type: "trip_cancelled",
          title: "Trip cancelled",
        }),
      );
    });
  });

  describe("handlePayoutFailed", () => {
    it("should create payout failed notification", async () => {
      global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);
      const service = new NotificationService();

      await service.handlePayoutFailed(
        {
          eventId: "evt-payoutfail-1",
          eventType: "payout.failed",
          eventVersion: 1,
          occurredAt: "2025-01-01T00:00:00.000Z",
          source: "payout-service",
          payload: {
            payoutId: "payout-1",
            driverId: "driver-1",
            driverEmail: "driver@example.com",
            driverName: "Tunde Driver",
            reference: "DX-PO-1",
            amountMinor: 125000,
            koraFeeAmount: 2500,
            currency: "NGN",
            failureReason: "Invalid account number",
            bankName: "GTBank",
            accountLast4: "1234",
          },
        },
        "payout.failed",
      );

      expect(global.mockDrizzle.insert).toHaveBeenCalledTimes(2);
      expect(global.mockNotificationValues).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          driverId: "driver-1",
          kind: "event",
          type: "payout_failed",
          title: "A payout needs review",
          tone: "critical",
        }),
      );
    });
  });
});
