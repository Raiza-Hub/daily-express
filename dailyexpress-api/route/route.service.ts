import type { Booking, CreateRoute, JWTPayload, Route, updateRouteRequest } from "@shared/types";
import { BookingService } from "./booking.service";
import { RouteCrudService } from "./route-crud.service";
import { RouteRepository } from "./route.repository";
import { SearchService } from "./search.service";
import { TripService } from "./trip.service";

type CreateBookingInput = {
  routeId: string;
  tripDate: string;
};

export class RouteService {
  private readonly crud: RouteCrudService;
  private readonly booking: BookingService;
  private readonly trip: TripService;
  private readonly search: SearchService;
  private readonly repo: RouteRepository;

  constructor() {
    this.repo = new RouteRepository();
    this.crud = new RouteCrudService(this.repo);
    this.booking = new BookingService(this.repo);
    this.trip = new TripService(this.repo);
    this.search = new SearchService();
  }

  async createRoute(user: JWTPayload, routeData: CreateRoute): Promise<Route> {
    return this.crud.createRoute(user, routeData);
  }

  async getAllDriverRoutes(user: JWTPayload): Promise<Route[]> {
    return this.crud.getAllDriverRoutes(user);
  }

  async updateRoute(
    user: JWTPayload,
    routeId: string,
    routeData: updateRouteRequest,
  ): Promise<Route> {
    return this.crud.updateRoute(user, routeId, routeData);
  }

  async deleteRoute(user: JWTPayload, routeId: string): Promise<void> {
    return this.crud.deleteRoute(user, routeId);
  }

  async updateTripStatus(
    user: JWTPayload,
    tripId: string,
    status: "booking_closed",
  ) {
    return this.trip.updateTripStatus(user, tripId, status);
  }

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
    limit?: number;
    cursor?: string;
  }): Promise<{ routes: Route[]; nextCursor: string | null }> {
    return this.search.searchRoutes(params);
  }
}

export const routeService = new RouteService();
