import type { Booking, CreateBooking, CreateRoute, JWTPayload, Route, updateRouteRequest } from "@shared/types";
import { BookingService } from "./booking.service";
import { RouteCrudService } from "./route-crud.service";
import { RouteRepository } from "./route.repository";
import { SearchService } from "./search.service";
import { TripClaimService } from "./trip-claim.service";
import { TripService } from "./trip.service";
import { resolveDriverId } from "./utils";

export class RouteService {
  private readonly crud: RouteCrudService;
  private readonly booking: BookingService;
  private readonly trip: TripService;
  private readonly search: SearchService;
  private readonly tripClaim: TripClaimService;
  private readonly repo: RouteRepository;

  constructor() {
    this.repo = new RouteRepository();
    this.crud = new RouteCrudService(this.repo);
    this.booking = new BookingService(this.repo);
    this.trip = new TripService(this.repo);
    this.search = new SearchService();
    this.tripClaim = new TripClaimService(this.repo);
  }

  async createRoute(routeData: CreateRoute): Promise<Route> {
    return this.crud.createRoute(routeData);
  }

  async getAllRoutes(): Promise<Route[]> {
    return this.crud.getAllRoutes();
  }

  async updateRoute(routeId: string, routeData: updateRouteRequest): Promise<Route> {
    return this.crud.updateRoute(routeId, routeData);
  }

  async deleteRoute(routeId: string): Promise<void> {
    return this.crud.deleteRoute(routeId);
  }

  async completeTrip(user: JWTPayload, tripId: string) {
    return this.trip.completeTrip(user, tripId);
  }

  async getDailyTripSummaries(user: JWTPayload, startDate: string, endDate: string) {
    return this.trip.getDailyTripSummaries(user, startDate, endDate);
  }

  async createCheckoutBooking(userId: string, input: CreateBooking) {
    return this.booking.createCheckoutBooking(userId, input);
  }

  async getUserBookings(userId: string, limit = 20, cursor?: string) {
    return this.booking.getUserBookings(userId, limit, cursor);
  }

  async searchBookingByRef(
    userId: string,
    paymentReference: string,
    lastName: string,
  ): Promise<Booking | null> {
    return this.booking.searchBookingByRef(userId, paymentReference, lastName);
  }

  async getTripBookings(user: JWTPayload, tripId: string) {
    return this.booking.getTripBookings(user, tripId);
  }

  async searchRoutes(params: {
    from: string;
    to: string;
    date: string;
    vehicleType?: string[];
    departureTime?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ routes: Route[]; nextCursor: string | null }> {
    return this.search.searchRoutes(params);
  }

  async getAvailableTrips(limit?: number, cursor?: string, search?: string, date?: string) {
    return this.tripClaim.getAvailableTrips(limit, cursor, search, date);
  }

  async getAvailableTripsCountByDate(startDate: string, endDate: string) {
    return this.tripClaim.getAvailableTripsCountByDate(startDate, endDate);
  }

  async claimTrip(user: JWTPayload, tripId: string, vehicleId: string) {
    const driverId = await resolveDriverId(user);
    return this.tripClaim.claimTrip(driverId, tripId, vehicleId);
  }
}

export const routeService = new RouteService();
