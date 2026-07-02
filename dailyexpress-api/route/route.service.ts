import type { JWTPayload } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { routeRepository } from "./route.repository";
import { bookingService } from "./booking.service";
import { tripService } from "./trip.service";
import { tripClaimService } from "./trip-claim.service";
import { searchService } from "./search.service";
type CreateBookingInput = {
  routeId: string;
  tripDate: string;
  vehicleType: "car" | "bus";
};

export class RouteService {
  constructor(
    private repo = routeRepository,
    private booking = bookingService,
    private trip = tripService,
    private tripClaim = tripClaimService,
    private search = searchService,
  ) {}

  async completeTrip(user: JWTPayload, tripId: string) {
    return this.trip.completeTrip(user, tripId);
  }

  async getDailyTripSummaries(
    user: JWTPayload,
    startDate: string,
    endDate: string,
  ) {
    return this.trip.getDailyTripSummaries(user, startDate, endDate);
  }

  async createCheckoutBooking(userId: string, input: CreateBookingInput) {
    return this.booking.createCheckoutBooking(userId, input);
  }

  async getUserBookings(userId: string, limit = 20, cursor?: string) {
    return this.booking.getUserBookings(userId, limit, cursor);
  }

  async searchBookingByRef(
    userId: string,
    paymentReference: string,
    lastName: string,
  ) {
    return this.booking.searchBookingByRef(userId, paymentReference, lastName);
  }

  async getTripBookings(user: JWTPayload, tripId: string) {
    return this.booking.getTripBookings(user, tripId);
  }

  async searchRoutes(params: {
    from: string;
    to: string;
    date: string;
    departureTime?: string;
    limit?: number;
    cursor?: string;
  }) {
    return this.search.searchRoutes(params);
  }

  async getAvailableTrips(limit?: number, cursor?: string, search?: string, date?: string) {
    return this.tripClaim.getAvailableTrips(limit, cursor, search, date);
  }

  async getAvailableTripsCountByDate(startDate: string, endDate: string) {
    return this.tripClaim.getAvailableTripsCountByDate(startDate, endDate);
  }

  async claimTrip(user: JWTPayload, tripId: string, vehicleId: string) {
    const driverRecord = await this.repo.findDriverByUserId(user.userId);
    if (!driverRecord) {
      throw createServiceError("Driver not found", 404);
    }
    return this.tripClaim.claimTrip(driverRecord.id, tripId, vehicleId);
  }

}

export const routeService = new RouteService();
