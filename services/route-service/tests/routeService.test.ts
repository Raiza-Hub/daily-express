import { RouteService } from "@/routeService";
import axios from "axios";
import type { JWTPayload } from "@shared/types";
import { testRoute } from "./setup";

// // 1. Properly mock Axios
// jest.mock("axios");
// const mockedAxios = axios as jest.Mocked<typeof axios>;

// Use this to refer to the axios mock defined in setup.ts
const mockedAxios = axios as jest.Mocked<typeof axios>;
const testGatewayUser: JWTPayload = {
  userId: "test-user-id",
  email: "test@dailyexpress.app",
  emailVerified: true,
};

// Robust helper function to test service error without 'instanceof' issues
async function expectServiceError(
  asyncFn: () => Promise<any>,
  expectedMessage: string,
  expectedStatusCode: number,
) {
  try {
    await asyncFn();
    // Use throw instead of fail() for better compatibility with Bun
    throw new Error("Expected function to throw Service Error");
  } catch (error: any) {
    // If it's the Axios TypeError, we want to see it clearly
    if (error.message && error.message.includes("isAxiosError")) {
      throw error;
    }

    // Check properties instead of instanceof to avoid prototype issues
    expect(error.statusCode || error.status).toBe(expectedStatusCode);
    expect(error.message).toBe(expectedMessage);
  }
}

describe("RouteService", () => {
  let routeService: RouteService;

  beforeEach(() => {
    jest.clearAllMocks();

    // 3. FIX: Manually define isAxiosError on the mock
    (axios.isAxiosError as any) = jest.fn((err) => !!err?.isAxiosError);

    // 4. Mock the internal Driver Service call that RouteService makes
    mockedAxios.get.mockResolvedValue({
      data: {
        success: true,
        data: { id: "test-driver-id" },
      },
    });

    routeService = new RouteService();
  });

  describe("createRoute", () => {
    const routeData = {
      driverId: "test-driver-id",
      pickup_location_title: "Ogun State",
      pickup_location_locality: "Ogun State",
      pickup_location_label: "Ogun State",
      dropoff_location_title: "Funnaab",
      dropoff_location_locality: "Funnaab",
      dropoff_location_label: "Funnaab",
      intermediate_stops_title: "Olurisho Street",
      intermediate_stops_locality: "Olurisho Street",
      intermediate_stops_label: "Olurisho Street",
      vehicleType: "bus" as "car" | "bus" | "luxury_car",
      meeting_point: "Main Park",
      availableSeats: 14,
      price: 13000,
      status: "active" as "active" | "inactive" | "pending",
      departure_time: new Date("2025-07-01T00:00:00Z"),
      arrival_time: new Date("2025-07-01T05:00:00Z"),
    };

    it("should create a route successfully", async () => {
      // Setup Drizzle Mocks
      (global.mockDrizzle.query.route.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      const mockValues = jest.fn().mockReturnThis();
      const mockReturning = jest.fn().mockResolvedValue([testRoute]);
      (global.mockDrizzle.insert as jest.Mock).mockReturnValue({
        values: mockValues,
        returning: mockReturning,
      });

      const result = await routeService.createRoute(testGatewayUser, routeData);

      expect(result).toEqual(testRoute);
      expect(global.mockDrizzle.insert).toHaveBeenCalled();
      // expect(mockValues).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     pickup_location: "Ogun State",
      //     driverId: "test-driver-id",
      //   }),
      // );
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          driverId: "test-driver-id",
          pickup_location_title: "Ogun State",
          pickup_location_locality: "Ogun State",
          dropoff_location_title: "Funnaab",
        }),
      );
    });

    it("should throw error if route already exists", async () => {
      // Mock findFirst to return an existing route
      (global.mockDrizzle.query.route.findFirst as jest.Mock).mockResolvedValue(
        testRoute,
      );

      await expectServiceError(
        () => routeService.createRoute(testGatewayUser, routeData),
        "Route already exists",
        400,
      );

      expect(global.mockDrizzle.insert).not.toHaveBeenCalled();
    });

    it("should handle driver service failure", async () => {
      // FIX: Ensure the structure matches exactly what your catch block looks for
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        message: "Request failed with status code 404",
        response: {
          status: 404,
          data: { message: "Driver not found" }, // Your code looks here!
        },
      });

      await expectServiceError(
        () => routeService.createRoute(testGatewayUser, routeData),
        "Driver not found", // Now this will match
        404,
      );
    });
  });

  describe("getAllDriverRoutes", () => {
    it("should get all driver routes successfully", async () => {
      // Setup Drizzle Mocks
      (global.mockDrizzle.query.route.findMany as jest.Mock).mockResolvedValue([
        testRoute,
      ]);

      const result = await routeService.getAllDriverRoutes(testGatewayUser);

      expect(result).toEqual([testRoute]);
      expect(global.mockDrizzle.query.route.findMany).toHaveBeenCalledWith({
        where: expect.anything(),
      });
    });

    it("should return empty array if no routes found", async () => {
      // Setup Drizzle Mocks
      (global.mockDrizzle.query.route.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      const result = await routeService.getAllDriverRoutes(testGatewayUser);

      expect(result).toEqual([]);
      expect(global.mockDrizzle.query.route.findMany).toHaveBeenCalledWith({
        where: expect.anything(),
      });
    });
  });

  describe("getAllUserRoutes", () => {
    it("should get all user routes successfully", async () => {
      // Setup Drizzle Mocks
      (global.mockDrizzle.query.route.findMany as jest.Mock).mockResolvedValue([
        testRoute,
      ]);

      const result = await routeService.getAllUserRoutes();

      expect(result).toEqual([testRoute]);
      expect(global.mockDrizzle.query.route.findMany).toHaveBeenCalledWith();
    });
  });

  describe("searchRoutes", () => {
    it("should search routes successfully", async () => {
      (global.mockDrizzle.query.route.findMany as jest.Mock).mockResolvedValue([
        testRoute,
      ]);

      const result = await routeService.searchRoutes({
        from: "Ogun State",
        to: "Funnaab",
        vehicleType: ["bus"],
      });

      expect(result).toEqual([testRoute]);
      expect(global.mockDrizzle.query.route.findMany).toHaveBeenCalledWith({
        where: expect.anything(),
      });
    });

    it("should throw when required params are missing", async () => {
      await expectServiceError(
        () =>
          routeService.searchRoutes({
            from: "Ogun State",
          }),
        "from and to are required",
        400,
      );

      expect(global.mockDrizzle.query.route.findMany).not.toHaveBeenCalled();
    });
  });

  describe("getRoute", () => {
    const routeId = "test-route-id";

    it("should get a route successfully", async () => {
      // Setup Drizzle Mocks
      (global.mockDrizzle.query.route.findFirst as jest.Mock).mockResolvedValue(
        testRoute,
      );

      const result = await routeService.getRoute(routeId);

      expect(result).toEqual(testRoute);
      expect(global.mockDrizzle.query.route.findFirst).toHaveBeenCalledWith(
        expect.anything(),
      );
    });

    it("should throw error if route not found", async () => {
      // Setup Drizzle Mocks
      (global.mockDrizzle.query.route.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expectServiceError(
        () => routeService.getRoute(routeId),
        "Route not found",
        404,
      );

      expect(global.mockDrizzle.query.route.findFirst).toHaveBeenCalledWith(
        expect.anything(),
      );
    });
  });

  describe("updateRoute", () => {
    const routeId = "test-route-id";
    const routeData = {
      driverId: "test-driver-id",
      pickup_location_title: "Ogun State",
      pickup_location_locality: "Ogun State",
      pickup_location_label: "Ogun State",
      dropoff_location_title: "Funnaab",
      dropoff_location_locality: "Funnaab",
      dropoff_location_label: "Funnaab",
      intermediate_stops_title: "Olurisho Street",
      intermediate_stops_locality: "Olurisho Street",
      intermediate_stops_label: "Olurisho Street",
      vehicleType: "bus" as "car" | "bus" | "luxury_car",
      availableSeats: 14,
      price: 13000,
      status: "active" as "active" | "inactive" | "pending",
      departure_time: new Date("2025-07-01T00:00:00Z"),
      arrival_time: new Date("2025-07-01T05:00:00Z"),
    };

    it("should update a route successfully", async () => {
      // Setup Drizzle Mocks
      (global.mockDrizzle.query.route.findFirst as jest.Mock).mockResolvedValue(
        testRoute,
      );

      const result = await routeService.updateRoute(
        testGatewayUser,
        routeId,
        routeData,
      );

      expect(result).toEqual(testRoute);
      expect(global.mockDrizzle.query.route.findFirst).toHaveBeenCalledWith(
        expect.anything(),
      );
      expect(global.mockDrizzle.update).toHaveBeenCalledWith(expect.anything());
    });

    it("should throw error if route not found", async () => {
      // Setup Drizzle Mocks
      (global.mockDrizzle.query.route.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expectServiceError(
        () => routeService.updateRoute(testGatewayUser, routeId, routeData),
        "Route not found",
        404,
      );

      expect(global.mockDrizzle.query.route.findFirst).toHaveBeenCalledWith(
        expect.anything(),
      );
    });
  });

  describe("deleteRoute", () => {
    const routeId = "test-route-id";

    it("should delete a route successfully", async () => {
      // Setup Drizzle Mocks
      (global.mockDrizzle.query.route.findFirst as jest.Mock).mockResolvedValue(
        testRoute,
      );

      // FIX: Setup the delete chain for this specific test
      const mockWhere = jest.fn().mockReturnThis();
      (global.mockDrizzle.delete as jest.Mock).mockReturnValue({
        where: mockWhere,
      });
      await routeService.deleteRoute(testGatewayUser, routeId);
      expect(mockWhere).toHaveBeenCalled();
      expect(global.mockDrizzle.delete).toHaveBeenCalled();
    });

    it("should throw error if route not found", async () => {
      // Setup Drizzle Mocks
      (global.mockDrizzle.query.route.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expectServiceError(
        () => routeService.deleteRoute(testGatewayUser, routeId),
        "Route not found",
        404,
      );

      expect(global.mockDrizzle.delete).not.toHaveBeenCalled();
    });
  });

  describe("bookTrip", () => {
    const userId = "test-user-id";
    const tripData = {
      routeId: "test-route-id",
      driverId: "test-driver-id",
      capacity: 14,
      bookedSeats: 0,
      status: "pending" as const,
      date: new Date("2025-07-01T00:00:00Z"),
    };

    it("should throw error if route not found", async () => {
      (global.mockDrizzle.query.route.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expectServiceError(
        () => routeService.bookTrip(userId, tripData),
        "Route not found",
        404,
      );
    });

    it("should throw error if trip is full", async () => {
      (global.mockDrizzle.query.route.findFirst as jest.Mock).mockResolvedValue(
        {
          ...testRoute,
          availableSeats: 14,
        },
      );
      (global.mockDrizzle.query.trip.findFirst as jest.Mock).mockResolvedValue({
        id: "test-trip-id",
        status: "pending",
        bookedSeats: 14,
      });

      await expectServiceError(
        () => routeService.bookTrip(userId, tripData),
        "Trip is full",
        400,
      );
    });
  });

  describe("getAllTrips", () => {
    const date = new Date("2025-07-01T00:00:00Z");
    it("should get all driver trips", async () => {
      const mockTrip = { id: "trip-uuid" };
      (global.mockDrizzle.query.trip.findMany as jest.Mock).mockResolvedValue([
        mockTrip,
      ]);
      const result = await routeService.getAllTrips(testGatewayUser, date);
      expect(result).toEqual([mockTrip]);
    });
  });

  describe("updateBookingStatus", () => {
    it("should update booking status", async () => {
      const bookingId = "booking-uuid";
      (
        global.mockDrizzle.query.booking.findFirst as jest.Mock
      ).mockResolvedValue({
        id: bookingId,
        tripId: "trip-uuid",
      });
      (global.mockDrizzle.query.trip.findFirst as jest.Mock).mockResolvedValue({
        id: "trip-uuid",
        bookedSeats: 5,
      });

      const mockValues = jest.fn().mockReturnThis();
      const mockReturning = jest
        .fn()
        .mockResolvedValue([{ id: bookingId, status: "completed" }]);
      (global.mockDrizzle.update as jest.Mock).mockReturnValue({
        set: mockValues,
        where: jest.fn().mockReturnThis(),
        returning: mockReturning,
      });

      const result = await routeService.updateBookingStatus(
        bookingId,
        "completed",
      );
      expect(result).toEqual({ id: bookingId, status: "completed" });
    });
  });

  describe("updateTripStatus", () => {
    it("should update trip status successfully", async () => {
      const tripId = "trip-uuid";
      (global.mockDrizzle.query.trip.findFirst as jest.Mock).mockResolvedValue({
        id: tripId,
        driverId: "test-driver-id",
        status: "pending",
      });

      const mockSet = jest.fn().mockReturnThis();
      const mockReturning = jest
        .fn()
        .mockResolvedValue([{ id: tripId, status: "completed" }]);
      (global.mockDrizzle.update as jest.Mock).mockReturnValue({
        set: mockSet,
        where: jest.fn().mockReturnThis(),
        returning: mockReturning,
      });

      const result = await routeService.updateTripStatus(
        testGatewayUser,
        tripId,
        "completed",
      );
      expect(result).toEqual({ id: tripId, status: "completed" });
    });

    it("should throw if unauthorized to update trip", async () => {
      (global.mockDrizzle.query.trip.findFirst as jest.Mock).mockResolvedValue({
        id: "trip-uuid",
        driverId: "another-driver",
      });
      await expectServiceError(
        () =>
          routeService.updateTripStatus(
            testGatewayUser,
            "trip-uuid",
            "completed",
          ),
        "You are not authorized to update this trip",
        403,
      );
    });
  });

  describe("getUserBookings", () => {
    it("should fetch all user bookings", async () => {
      (
        global.mockDrizzle.query.booking.findMany as jest.Mock
      ).mockResolvedValue([{ id: "booking-uuid" }]);
      const result = await routeService.getUserBookings("user-uuid");
      expect(result).toEqual([{ id: "booking-uuid" }]);
    });
  });
});
