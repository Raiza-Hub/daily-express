import type { CreateBooking, JWTPayload, OriginDetails } from "@shared/types";
import { BookingService } from "./booking.service";
import { RouteRepository } from "./route.repository";
import { TripService } from "./trip.service";

export class RouteService {
  private readonly booking: BookingService;
  private readonly trip: TripService;
  private readonly repo: RouteRepository;

  constructor() {
    this.repo = new RouteRepository();
    this.booking = new BookingService(this.repo);
    this.trip = new TripService(this.repo);
  }

  async getOrigins(): Promise<OriginDetails[]> {
    const rows = await this.repo.findActiveOrigins();
    return rows.map((o) => ({
      id: o.id,
      title: o.title,
      meetingPoint: o.meetingPoint,
      departureTime: o.departureTime,
      price: o.price,
      fee: o.fee,
      luggageFee: o.luggageFee,
      destinations: o.destinations.map((d) => ({ id: d.id, title: d.title })),
    }));
  }

  async completeTrip(user: JWTPayload, tripId: string) {
    return this.trip.completeTrip(user, tripId);
  }

  async createCheckoutBooking(userId: string, input: CreateBooking) {
    return this.booking.createCheckoutBooking(userId, input);
  }

  async getUserBookings(userId: string, limit = 20, cursor?: string) {
    return this.booking.getUserBookings(userId, limit, cursor);
  }

  async getTripPassengers(user: JWTPayload, tripId: string) {
    return this.booking.getTripPassengers(user, tripId);
  }

  async getDriverTrips(user: JWTPayload, from: string, to: string) {
    return this.trip.getDriverTrips(user, from, to);
  }

  async cancelTrip(user: JWTPayload, tripId: string) {
    return this.trip.cancelTrip(user, tripId);
  }

  async initiateTripPayout(user: JWTPayload, tripId: string) {
    return this.trip.initiateTripPayout(user, tripId);
  }
}

export const routeService = new RouteService();
