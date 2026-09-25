import type { Booking, CreateBooking, JWTPayload, OriginDetails } from "@shared/types";
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

}

export const routeService = new RouteService();
