import { RouteService } from "@/routeService";
import {
  testDriverIdentity,
  testGatewayUser,
  testPassengerIdentity,
} from "./setup";

describe("RouteService getTripBookings", () => {
  const routeService = new RouteService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("enriches confirmed trip bookings with local passenger projections", async () => {
    global.mockDrizzle.query.trip.findFirst.mockResolvedValue({
      id: "trip-1",
      driverId: testDriverIdentity.driverId,
    });
    global.mockDrizzle.query.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        tripId: "trip-1",
        userId: testPassengerIdentity.userId,
        seatNumber: 3,
        status: "confirmed",
        paymentStatus: "paid",
        createdAt: new Date("2025-07-01T00:00:00Z"),
      },
    ]);
    global.mockDrizzle.query.passengerIdentity.findMany.mockResolvedValue([
      testPassengerIdentity,
    ]);

    const result = await routeService.getTripBookings(testGatewayUser, "trip-1");

    expect(result).toEqual([
      expect.objectContaining({
        id: "booking-1",
        seatNumber: 3,
        user: {
          id: testPassengerIdentity.userId,
          firstName: testPassengerIdentity.firstName,
          lastName: testPassengerIdentity.lastName,
          email: testPassengerIdentity.email,
          phone: null,
        },
      }),
    ]);
    expect(
      global.mockDrizzle.query.passengerIdentity.findMany,
    ).toHaveBeenCalled();
  });
});
