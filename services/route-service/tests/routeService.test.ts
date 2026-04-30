import { RouteService } from "@/routeService";
import {
  testDriverIdentity,
  testGatewayUser,
  testPassengerIdentity,
  testRoute,
} from "./setup";
import {
  emitBookingCancelled,
  emitBookingConfirmed,
} from "../src/kafka/producer";

const routeService = new RouteService();

async function expectServiceError(
  asyncFn: () => Promise<unknown>,
  expectedMessage: string,
  expectedStatusCode: number,
) {
  try {
    await asyncFn();
    throw new Error("Expected function to throw");
  } catch (error: any) {
    expect(error.message).toBe(expectedMessage);
    expect(error.statusCode).toBe(expectedStatusCode);
  }
}

describe("RouteService", () => {
  describe("createRoute", () => {
    const routeData = {
      pickup_location_title: "Ogun State",
      pickup_location_locality: "Ogun State",
      pickup_location_label: "Ogun State",
      dropoff_location_title: "Funnaab",
      dropoff_location_locality: "Funnaab",
      dropoff_location_label: "Funnaab",
      intermediate_stops_title: "Olurisho Street",
      intermediate_stops_locality: "Olurisho Street",
      intermediate_stops_label: "Olurisho Street",
      vehicleType: "bus" as const,
      meeting_point: "Main Park",
      availableSeats: 14,
      price: 13000,
      status: "active" as const,
      departure_time: new Date("2025-07-01T08:00:00Z"),
      arrival_time: new Date("2025-07-01T13:00:00Z"),
    };

    it("creates a route using the local driver identity projection", async () => {
      global.mockDrizzle.query.route.findFirst.mockResolvedValue(null);
      global.mockDrizzle.insert.mockReturnValue({
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          {
            ...testRoute,
            driverId: testDriverIdentity.driverId,
          },
        ]),
      });

      const result = await routeService.createRoute(testGatewayUser, routeData);

      expect(result.driver.id).toBe(testDriverIdentity.driverId);
      expect(global.mockDrizzle.query.driverIdentity.findFirst).toHaveBeenCalled();
    });

    it("rejects duplicate routes on the same departure time", async () => {
      global.mockDrizzle.query.route.findFirst.mockResolvedValue(testRoute);

      await expectServiceError(
        () => routeService.createRoute(testGatewayUser, routeData),
        "Route already exists",
        400,
      );
    });
  });

  describe("searchRoutes", () => {
    it("returns routes even when no trip exists for that day", async () => {
      global.mockSelectResult = [
        {
          ...testRoute,
          pickupScore: 1,
          dropoffScore: 1,
          combinedScore: 2,
        },
      ];
      global.mockDrizzle.query.trip.findMany.mockResolvedValue([]);

      const result = await routeService.searchRoutes({
        from: "Ogun State",
        to: "Funnaab",
        date: "2025-07-01",
      });

      expect(result).toHaveLength(1);
      expect(result[0].remainingSeats).toBe(testRoute.availableSeats);
      expect(result[0].driver.firstName).toBe(testDriverIdentity.firstName);
    });

    it("does not return routes whose trips are already full for that day", async () => {
      global.mockSelectResult = [
        {
          ...testRoute,
          pickupScore: 1,
          dropoffScore: 1,
          combinedScore: 2,
        },
      ];
      global.mockDrizzle.query.trip.findMany.mockResolvedValue([
        {
          id: "trip-1",
          routeId: testRoute.id,
          driverId: testDriverIdentity.driverId,
          date: new Date("2025-07-01T08:00:00Z"),
          capacity: testRoute.availableSeats,
          bookedSeats: testRoute.availableSeats,
          status: "confirmed",
        },
      ]);

      const result = await routeService.searchRoutes({
        from: "Ogun State",
        to: "Funnaab",
        date: "2025-07-01",
      });

      expect(result).toEqual([]);
    });
  });

  describe("createBooking", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2025-07-01T06:00:00.000Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("creates the trip for the requested date when it does not exist yet", async () => {
      global.mockDrizzle.transaction.mockImplementation(async (callback) => {
        const tripFindFirst = jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: "trip-1",
            routeId: testRoute.id,
            driverId: testDriverIdentity.driverId,
            date: new Date("2025-06-30T23:00:00.000Z"),
            status: "pending",
            bookedSeats: 0,
            capacity: 14,
          });
        const tx = {
          ...global.mockDrizzle,
          query: {
            ...global.mockDrizzle.query,
            route: {
              ...global.mockDrizzle.query.route,
              findFirst: jest.fn().mockResolvedValue(testRoute),
            },
            trip: {
              ...global.mockDrizzle.query.trip,
              findFirst: tripFindFirst,
            },
          },
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([
              {
                id: "trip-1",
                bookedSeats: 3,
                capacity: 14,
              },
            ]),
          }),
          insert: jest
            .fn()
            .mockReturnValueOnce({
              values: jest.fn().mockReturnThis(),
              onConflictDoNothing: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([
                {
                  id: "trip-1",
                  routeId: testRoute.id,
                  driverId: testDriverIdentity.driverId,
                  date: new Date("2025-06-30T23:00:00.000Z"),
                  status: "pending",
                  bookedSeats: 0,
                  capacity: 14,
                },
              ]),
            })
            .mockReturnValueOnce({
              values: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([
                {
                  id: "booking-1",
                  tripId: "trip-1",
                  userId: testPassengerIdentity.userId,
                  seatNumber: 3,
                  lastName: testPassengerIdentity.lastName,
                  status: "pending",
                  expiresAt: new Date("2025-07-01T00:10:00Z"),
                },
              ]),
            }),
        };

        return callback(tx);
      });

      const booking = await routeService.createBooking(
        testPassengerIdentity.userId,
        {
          routeId: testRoute.id,
          tripDate: "2025-07-01",
        },
      );

      expect(booking.lastName).toBe(testPassengerIdentity.lastName);
      expect(global.mockDrizzle.transaction).toHaveBeenCalled();
    });

    it("rejects booking after the scheduled departure time has passed", async () => {
      jest.setSystemTime(new Date("2025-07-01T08:01:00.000Z"));
      const tripFindFirst = jest.fn();

      global.mockDrizzle.transaction.mockImplementation(async (callback) => {
        const tx = {
          ...global.mockDrizzle,
          query: {
            ...global.mockDrizzle.query,
            route: {
              ...global.mockDrizzle.query.route,
              findFirst: jest.fn().mockResolvedValue(testRoute),
            },
            trip: {
              ...global.mockDrizzle.query.trip,
              findFirst: tripFindFirst,
            },
          },
        };

        return callback(tx);
      });

      await expectServiceError(
        () =>
          routeService.createBooking(testPassengerIdentity.userId, {
            routeId: testRoute.id,
            tripDate: "2025-07-01",
          }),
        "This trip has already departed and can no longer be booked",
        400,
      );
      expect(tripFindFirst).not.toHaveBeenCalled();
    });

    it("rejects booking a completed trip", async () => {
      global.mockDrizzle.transaction.mockImplementation(async (callback) => {
        const tx = {
          ...global.mockDrizzle,
          query: {
            ...global.mockDrizzle.query,
            route: {
              ...global.mockDrizzle.query.route,
              findFirst: jest.fn().mockResolvedValue(testRoute),
            },
            trip: {
              ...global.mockDrizzle.query.trip,
              findFirst: jest.fn().mockResolvedValue({
                id: "trip-1",
                routeId: testRoute.id,
                driverId: testDriverIdentity.driverId,
                status: "completed",
                bookedSeats: 2,
                capacity: 14,
              }),
            },
          },
        };

        return callback(tx);
      });

      await expectServiceError(
        () =>
          routeService.createBooking(testPassengerIdentity.userId, {
            routeId: testRoute.id,
            tripDate: "2025-07-01",
          }),
        "Trip is not open for booking",
        400,
      );
    });

    it("returns the existing pending booking instead of reserving another seat", async () => {
      const existingBooking = {
        id: "booking-1",
        tripId: "trip-1",
        userId: testPassengerIdentity.userId,
        seatNumber: 2,
        lastName: testPassengerIdentity.lastName,
        status: "pending" as const,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };

      const updateSpy = jest.fn();
      const insertSpy = jest.fn();

      global.mockDrizzle.transaction.mockImplementation(async (callback) => {
        const tx = {
          ...global.mockDrizzle,
          query: {
            ...global.mockDrizzle.query,
            route: {
              ...global.mockDrizzle.query.route,
              findFirst: jest.fn().mockResolvedValue(testRoute),
            },
            trip: {
              ...global.mockDrizzle.query.trip,
              findFirst: jest.fn().mockResolvedValue({
                id: "trip-1",
                routeId: testRoute.id,
                driverId: testDriverIdentity.driverId,
                date: new Date("2025-06-30T23:00:00.000Z"),
                status: "pending",
                bookedSeats: 2,
                capacity: 14,
              }),
            },
            booking: {
              ...global.mockDrizzle.query.booking,
              findFirst: jest.fn().mockResolvedValue(existingBooking),
            },
          },
          update: updateSpy,
          insert: insertSpy,
        };

        return callback(tx);
      });

      const booking = await routeService.createBooking(
        testPassengerIdentity.userId,
        {
          routeId: testRoute.id,
          tripDate: "2025-07-01",
        },
      );

      expect(booking).toEqual(existingBooking);
      expect(updateSpy).not.toHaveBeenCalled();
      expect(insertSpy).not.toHaveBeenCalled();
    });

    it("rejects a duplicate confirmed booking for the same passenger and trip", async () => {
      global.mockDrizzle.transaction.mockImplementation(async (callback) => {
        const tx = {
          ...global.mockDrizzle,
          query: {
            ...global.mockDrizzle.query,
            route: {
              ...global.mockDrizzle.query.route,
              findFirst: jest.fn().mockResolvedValue(testRoute),
            },
            trip: {
              ...global.mockDrizzle.query.trip,
              findFirst: jest.fn().mockResolvedValue({
                id: "trip-1",
                routeId: testRoute.id,
                driverId: testDriverIdentity.driverId,
                date: new Date("2025-06-30T23:00:00.000Z"),
                status: "confirmed",
                bookedSeats: 2,
                capacity: 14,
              }),
            },
            booking: {
              ...global.mockDrizzle.query.booking,
              findFirst: jest.fn().mockResolvedValue({
                id: "booking-1",
                tripId: "trip-1",
                userId: testPassengerIdentity.userId,
                seatNumber: 2,
                lastName: testPassengerIdentity.lastName,
                status: "confirmed",
                expiresAt: null,
              }),
            },
          },
        };

        return callback(tx);
      });

      await expectServiceError(
        () =>
          routeService.createBooking(testPassengerIdentity.userId, {
            routeId: testRoute.id,
            tripDate: "2025-07-01",
          }),
        "You already have a confirmed booking for this trip",
        409,
      );
    });

    it("releases the provisional seat increment when a concurrent duplicate booking wins the race", async () => {
      const duplicateBookingError = {
        code: "23505",
        constraint: "booking_trip_id_user_id_active_idx",
      };
      const provisionalSeatUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          {
            id: "trip-1",
            bookedSeats: 3,
            capacity: 14,
          },
        ]),
      };
      const releaseSeatUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(undefined),
      };
      const duplicatePendingBooking = {
        id: "booking-1",
        tripId: "trip-1",
        userId: testPassengerIdentity.userId,
        seatNumber: 2,
        lastName: testPassengerIdentity.lastName,
        status: "pending" as const,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };

      global.mockDrizzle.transaction.mockImplementation(async (callback) => {
        const tx = {
          ...global.mockDrizzle,
          query: {
            ...global.mockDrizzle.query,
            route: {
              ...global.mockDrizzle.query.route,
              findFirst: jest.fn().mockResolvedValue(testRoute),
            },
            trip: {
              ...global.mockDrizzle.query.trip,
              findFirst: jest.fn().mockResolvedValue({
                id: "trip-1",
                routeId: testRoute.id,
                driverId: testDriverIdentity.driverId,
                date: new Date("2025-06-30T23:00:00.000Z"),
                status: "pending",
                bookedSeats: 2,
                capacity: 14,
              }),
            },
            booking: {
              ...global.mockDrizzle.query.booking,
              findFirst: jest
                .fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(duplicatePendingBooking),
            },
          },
          update: jest
            .fn()
            .mockReturnValueOnce(provisionalSeatUpdate)
            .mockReturnValueOnce(releaseSeatUpdate),
          insert: jest
            .fn()
            .mockReturnValueOnce({
              values: jest.fn().mockReturnThis(),
              returning: jest.fn().mockRejectedValue(duplicateBookingError),
            }),
        };

        return callback(tx);
      });

      const booking = await routeService.createBooking(
        testPassengerIdentity.userId,
        {
          routeId: testRoute.id,
          tripDate: "2025-07-01",
        },
      );

      expect(booking).toEqual(duplicatePendingBooking);
      expect(releaseSeatUpdate.set).toHaveBeenCalled();
      expect(releaseSeatUpdate.where).toHaveBeenCalled();
    });
  });

  describe("syncBookingPaymentStatus", () => {
    it("emits booking.confirmed when a pending booking is paid successfully", async () => {
      global.mockDrizzle.query.booking.findFirst.mockResolvedValueOnce({
        id: "booking-1",
        tripId: "trip-1",
        userId: testPassengerIdentity.userId,
        seatNumber: 3,
        status: "pending",
        paymentReference: null,
      });
      global.mockDrizzle.update.mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          {
            id: "booking-1",
            tripId: "trip-1",
            userId: testPassengerIdentity.userId,
            seatNumber: 3,
            status: "confirmed",
            paymentReference: "PAY-1",
            paymentStatus: "successful",
          },
        ]),
      });
      global.mockDrizzle.query.booking.findFirst.mockResolvedValueOnce({
        id: "booking-1",
        tripId: "trip-1",
        userId: testPassengerIdentity.userId,
        seatNumber: 3,
        status: "confirmed",
        paymentReference: "PAY-1",
        paymentStatus: "successful",
      });
      global.mockDrizzle.query.trip.findFirst.mockResolvedValue({
        id: "trip-1",
        routeId: testRoute.id,
        driverId: testDriverIdentity.driverId,
        date: new Date("2025-07-01T08:00:00Z"),
      });
      global.mockDrizzle.query.route.findFirst.mockResolvedValue(testRoute);

      const result = await routeService.syncBookingPaymentStatus({
        bookingId: "booking-1",
        paymentReference: "PAY-1",
        paymentStatus: "successful",
      });

      expect(result.status).toBe("confirmed");
      expect(emitBookingConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: "booking-1",
          tripId: "trip-1",
          routeId: testRoute.id,
          driverId: testDriverIdentity.driverId,
          fareAmountMinor: testRoute.price * 100,
          paymentReference: "PAY-1",
        }),
      );
    });

    it("emits booking.cancelled and clears the seat when a pending booking payment fails", async () => {
      global.mockDrizzle.query.booking.findFirst.mockResolvedValueOnce({
        id: "booking-2",
        tripId: "trip-2",
        userId: testPassengerIdentity.userId,
        seatNumber: 5,
        status: "pending",
        paymentReference: null,
      });
      global.mockDrizzle.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          ...global.mockDrizzle,
          update: jest
            .fn()
            .mockReturnValueOnce({
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
            })
            .mockReturnValueOnce({
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([
                {
                  id: "booking-2",
                  tripId: "trip-2",
                  userId: testPassengerIdentity.userId,
                  seatNumber: null,
                  status: "cancelled",
                  paymentReference: "PAY-2",
                  paymentStatus: "failed",
                },
              ]),
            }),
        };

        return callback(tx);
      });
      global.mockDrizzle.query.booking.findFirst.mockResolvedValueOnce({
        id: "booking-2",
        tripId: "trip-2",
        userId: testPassengerIdentity.userId,
        seatNumber: null,
        status: "cancelled",
        paymentReference: "PAY-2",
        paymentStatus: "failed",
      });
      global.mockDrizzle.query.trip.findFirst.mockResolvedValue({
        id: "trip-2",
        routeId: testRoute.id,
        driverId: testDriverIdentity.driverId,
        bookedSeats: 4,
      });
      global.mockDrizzle.query.route.findFirst.mockResolvedValue(testRoute);

      const result = await routeService.syncBookingPaymentStatus({
        bookingId: "booking-2",
        paymentReference: "PAY-2",
        paymentStatus: "failed",
      });

      expect(result.status).toBe("cancelled");
      expect(result.seatNumber).toBeNull();
      expect(emitBookingCancelled).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: "booking-2",
          tripId: "trip-2",
          routeId: testRoute.id,
          driverId: testDriverIdentity.driverId,
          paymentReference: "PAY-2",
        }),
      );
    });
  });

  describe("getUserBookings", () => {
    it("does not show unpaid pending checkout holds as user bookings", async () => {
      global.mockDrizzle.query.booking.findMany.mockResolvedValue([
        {
          id: "booking-pending",
          tripId: "trip-1",
          userId: testPassengerIdentity.userId,
          seatNumber: 3,
          status: "pending",
          paymentReference: "PAY-PENDING",
          paymentStatus: "pending",
          createdAt: new Date("2025-07-01T00:00:00Z"),
          updatedAt: new Date("2025-07-01T00:00:00Z"),
        },
      ]);
      global.mockSelectResult = [{ count: 0 }];

      const result = await routeService.getUserBookings(
        testPassengerIdentity.userId,
      );

      expect(result.total).toBe(0);
      expect(result.bookings).toEqual([]);
    });

    it("uses a real aggregate count result and local driver projections", async () => {
      global.mockDrizzle.query.booking.findMany.mockResolvedValue([
        {
          id: "booking-1",
          tripId: "trip-1",
          userId: testPassengerIdentity.userId,
          seatNumber: 3,
          status: "confirmed",
          paymentReference: "PAY-1",
          paymentStatus: "successful",
          createdAt: new Date("2025-07-01T00:00:00Z"),
          updatedAt: new Date("2025-07-01T00:00:00Z"),
        },
        {
          id: "booking-2",
          tripId: "trip-2",
          userId: testPassengerIdentity.userId,
          seatNumber: null,
          status: "cancelled",
          paymentReference: "PAY-2",
          paymentStatus: "cancelled",
          createdAt: new Date("2025-07-02T00:00:00Z"),
          updatedAt: new Date("2025-07-02T00:00:00Z"),
        },
      ]);
      global.mockSelectResult = [{ count: 1 }];
      global.mockDrizzle.query.trip.findMany.mockResolvedValue([
        {
          id: "trip-1",
          routeId: testRoute.id,
          driverId: testRoute.driverId,
          date: new Date("2025-07-01T08:00:00Z"),
          bookedSeats: 3,
          capacity: 14,
          status: "confirmed",
        },
      ]);
      global.mockDrizzle.query.route.findMany.mockResolvedValue([testRoute]);

      const result = await routeService.getUserBookings(
        testPassengerIdentity.userId,
      );

      expect(result.total).toBe(1);
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0].id).toBe("booking-1");
      expect(result.bookings[0].trip?.route.driver?.id).toBe(
        testDriverIdentity.driverId,
      );
    });
  });

  describe("getTripsSummaryRange", () => {
    it("does not count unpaid pending checkout holds as passengers or earnings", async () => {
      global.mockDrizzle.query.trip.findMany.mockResolvedValue([
        {
          id: "trip-1",
          routeId: testRoute.id,
          driverId: testDriverIdentity.driverId,
          date: new Date("2025-06-30T23:00:00.000Z"),
          bookedSeats: 1,
          capacity: 14,
          status: "pending",
        },
      ]);
      global.mockDrizzle.query.route.findMany.mockResolvedValue([testRoute]);
      global.mockDrizzle.query.booking.findMany.mockResolvedValue([
        {
          id: "booking-pending",
          tripId: "trip-1",
          userId: testPassengerIdentity.userId,
          seatNumber: 1,
          status: "pending",
          paymentReference: "PAY-PENDING",
          paymentStatus: "pending",
          createdAt: new Date("2025-07-01T00:00:00Z"),
          updatedAt: new Date("2025-07-01T00:00:00Z"),
        },
      ]);

      const result = await routeService.getTripsSummaryRange(
        testGatewayUser,
        "2025-07-01",
        "2025-07-01",
      );

      expect(result).toEqual([]);
    });

    it("includes route schedule fields while keeping trips grouped by business date", async () => {
      global.mockDrizzle.query.trip.findMany.mockResolvedValue([
        {
          id: "trip-1",
          routeId: testRoute.id,
          driverId: testDriverIdentity.driverId,
          date: new Date("2025-06-30T23:00:00.000Z"),
          bookedSeats: 4,
          capacity: 14,
          status: "confirmed",
        },
      ]);
      global.mockDrizzle.query.route.findMany.mockResolvedValue([testRoute]);
      global.mockDrizzle.query.booking.findMany.mockResolvedValue([
        {
          id: "booking-1",
          tripId: "trip-1",
          userId: testPassengerIdentity.userId,
          seatNumber: 3,
          status: "confirmed",
          paymentReference: "PAY-1",
          paymentStatus: "successful",
          createdAt: new Date("2025-07-01T00:00:00Z"),
          updatedAt: new Date("2025-07-01T00:00:00Z"),
        },
      ]);

      const result = await routeService.getTripsSummaryRange(
        testGatewayUser,
        "2025-07-01",
        "2025-07-07",
      );

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe("2025-07-01");
      expect(result[0].trips[0].route).toEqual(
        expect.objectContaining({
          id: testRoute.id,
          pickup_location_locality: testRoute.pickup_location_locality,
          dropoff_location_locality: testRoute.dropoff_location_locality,
          departure_time: testRoute.departure_time,
          arrival_time: testRoute.arrival_time,
        }),
      );
    });

    it("hides trips that only have cancelled or terminated bookings", async () => {
      global.mockDrizzle.query.trip.findMany.mockResolvedValue([
        {
          id: "trip-1",
          routeId: testRoute.id,
          driverId: testDriverIdentity.driverId,
          date: new Date("2025-07-01T08:00:00.000Z"),
          bookedSeats: 1,
          capacity: 14,
          status: "confirmed",
        },
      ]);
      global.mockDrizzle.query.route.findMany.mockResolvedValue([testRoute]);
      global.mockDrizzle.query.booking.findMany.mockResolvedValue([
        {
          id: "booking-1",
          tripId: "trip-1",
          userId: testPassengerIdentity.userId,
          seatNumber: null,
          status: "cancelled",
          paymentReference: "PAY-1",
          paymentStatus: "cancelled",
          createdAt: new Date("2025-07-01T00:00:00Z"),
          updatedAt: new Date("2025-07-01T00:00:00Z"),
        },
      ]);

      const result = await routeService.getTripsSummaryRange(
        testGatewayUser,
        "2025-07-01",
        "2025-07-07",
      );

      expect(result).toHaveLength(0);
    });
  });
});
