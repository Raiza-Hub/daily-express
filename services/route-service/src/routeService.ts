import axios from "axios";
import { and, eq, inArray, or, ilike } from "drizzle-orm";
import { booking, route, trip } from "db/schema";
import { db } from "../db/db";
import type {
  Booking,
  CreateRoute,
  CreateTrip,
  Driver,
  JWTPayload,
  Route,
  ServiceResponse,
  Trip,
  updateRouteRequest,
} from "@shared/types";
import { createServiceError } from "@shared/utils";
const ALLOWED_VEHICLE_TYPES = ["car", "bus", "luxury_car"] as const;

type VehicleType = (typeof ALLOWED_VEHICLE_TYPES)[number];

export class RouteService {
  private readonly driverServiceUrl: string;

  constructor() {
    this.driverServiceUrl =
      process.env.DRIVER_SERVICE_URL || "http://localhost:5002/v1/driver";
  }

  private async getDriverId(user: JWTPayload): Promise<string> {
    try {
      const response = await axios.get<ServiceResponse<Driver>>(
        `${this.driverServiceUrl}/profile`,
        {
          headers: {
            "x-user-id": user.userId,
            "x-user-email": user.email,
            "x-user-email-verified": String(user.emailVerified),
            ...(user.role ? { "x-user-role": user.role } : {}),
          },
        },
      );

      if (!response.data.success || !response.data.data) {
        throw createServiceError("Driver profile lookup failed", 401);
      }

      return response.data.data.id;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          error.response?.data?.message ||
          error.message ||
          "Driver service failed";
        const status = error.response?.status || 500;

        throw createServiceError(message, status);
      }

      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ECONNREFUSED"
      ) {
        throw createServiceError("Driver service is offline", 502);
      }

      throw createServiceError(
        "An unexpected error occurred in RouteService",
        500,
      );
    }
  }

  async createRoute(user: JWTPayload, routeData: CreateRoute): Promise<Route> {
    const driverId = await this.getDriverId(user);

    const existingRoute = await db.query.route.findFirst({
      where: and(
        eq(route.driverId, driverId),
        eq(route.pickup_location_title, routeData.pickup_location_title),
        eq(route.pickup_location_locality, routeData.pickup_location_locality),
        eq(route.pickup_location_label, routeData.pickup_location_label),
        eq(route.dropoff_location_title, routeData.dropoff_location_title),
        eq(
          route.dropoff_location_locality,
          routeData.dropoff_location_locality,
        ),
        eq(route.dropoff_location_label, routeData.dropoff_location_label),
      ),
    });

    if (existingRoute) {
      throw createServiceError("Route already exists", 400);
    }

    const [newRoute] = await db
      .insert(route)
      .values({ ...routeData, driverId })
      .returning();

    return newRoute;
  }

  async getAllDriverRoutes(user: JWTPayload): Promise<Route[]> {
    const driverId = await this.getDriverId(user);

    return db.query.route.findMany({
      where: eq(route.driverId, driverId),
    });
  }

  async getAllUserRoutes(): Promise<Route[]> {
    return db.query.route.findMany();
  }

  async searchRoutes(params: {
    from?: string;
    to?: string;
    vehicleType?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Route[]> {
    const { from, to, vehicleType, limit = 20, offset = 0 } = params;
    const parsedFrom = from?.trim();
    const parsedTo = to?.trim();
    const parsedVehicleType = vehicleType?.filter(
      (value): value is VehicleType =>
        ALLOWED_VEHICLE_TYPES.includes(value as VehicleType),
    );

    if (!parsedFrom || !parsedTo) {
      throw createServiceError("from and to are required", 400);
    }

    const pickupMatch = or(
      ilike(route.pickup_location_title, `%${parsedFrom}%`),
      ilike(route.pickup_location_label, `%${parsedFrom}%`),
    );
    const dropoffMatch = or(
      ilike(route.dropoff_location_title, `%${parsedTo}%`),
      ilike(route.dropoff_location_label, `%${parsedTo}%`),
    );

    const conditions = [
      eq(route.status, "active"),
      or(pickupMatch, dropoffMatch),
    ];

    if (parsedVehicleType && parsedVehicleType.length > 0) {
      conditions.push(inArray(route.vehicleType, parsedVehicleType));
    }

    const routes = await db.query.route.findMany({
      where: and(...conditions),
      limit,
      offset,
    });

    const uniqueDriverIds = [...new Set(routes.map((r) => r.driverId))];
    const driverCache = new Map<string, Route["driver"]>();

    await Promise.all(
      uniqueDriverIds.map(async (driverId) => {
        try {
          const driver = await this.getDriverById(driverId);
          if (driver) {
            driverCache.set(driverId, driver);
          }
        } catch {
          // Skip drivers that can't be fetched
        }
      }),
    );

    return routes.map((r) => ({
      ...r,
      driver: driverCache.get(r.driverId),
    }));
  }

  private async getDriverById(
    driverId: string,
  ): Promise<Route["driver"] | null> {
    try {
      const response = await axios.get<ServiceResponse<Route["driver"]>>(
        `${this.driverServiceUrl}/public/${driverId}`,
      );
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  async getRoute(routeId: string): Promise<Route> {
    const existingRoute = await db.query.route.findFirst({
      where: eq(route.id, routeId),
    });

    if (!existingRoute) {
      throw createServiceError("Route not found", 404);
    }

    return existingRoute;
  }

  async updateRoute(
    user: JWTPayload,
    routeId: string,
    routeData: updateRouteRequest,
  ): Promise<Route> {
    const driverId = await this.getDriverId(user);
    const existingRoute = await db.query.route.findFirst({
      where: eq(route.id, routeId),
    });

    if (!existingRoute) {
      throw createServiceError("Route not found", 404);
    }

    if (existingRoute.driverId !== driverId) {
      throw createServiceError(
        "You are not authorized to update this route",
        403,
      );
    }

    const [updatedRoute] = await db
      .update(route)
      .set(routeData)
      .where(eq(route.id, routeId))
      .returning();

    return updatedRoute;
  }

  async deleteRoute(user: JWTPayload, routeId: string): Promise<void> {
    const driverId = await this.getDriverId(user);
    const existingRoute = await db.query.route.findFirst({
      where: eq(route.id, routeId),
    });

    if (!existingRoute) {
      throw createServiceError("Route not found", 404);
    }

    if (existingRoute.driverId !== driverId) {
      throw createServiceError(
        "You are not authorized to delete this route",
        403,
      );
    }

    await db.delete(route).where(eq(route.id, routeId));
  }

  async bookTrip(userId: string, tripData: CreateTrip): Promise<Booking> {
    const existingRoute = await this.getRoute(tripData.routeId);

    const existingTrip = await db.query.trip.findFirst({
      where: and(
        eq(trip.routeId, tripData.routeId),
        eq(trip.date, tripData.date),
      ),
    });

    if (!existingTrip) {
      const [newTrip] = await db
        .insert(trip)
        .values({
          ...tripData,
          driverId: existingRoute.driverId,
          capacity: existingRoute.availableSeats,
          bookedSeats: 1,
          status: "pending",
        })
        .returning();

      const [newBooking] = await db
        .insert(booking)
        .values({
          tripId: newTrip.id,
          userId,
          seatNumber: 1,
          status: "pending",
          paymentStatus: "initialized",
        })
        .returning();

      return newBooking;
    }

    if (existingTrip.status === "completed") {
      throw createServiceError("Trip already completed", 400);
    }
    if (existingTrip.status === "cancelled") {
      throw createServiceError("Trip already cancelled", 400);
    }
    if (existingTrip.status === "confirmed") {
      throw createServiceError("Trip already confirmed", 400);
    }
    if (existingTrip.bookedSeats >= existingRoute.availableSeats) {
      throw createServiceError("Trip is full", 400);
    }
    if (existingTrip.status !== "pending") {
      throw createServiceError("Invalid trip status", 400);
    }

    await db
      .update(trip)
      .set({ bookedSeats: existingTrip.bookedSeats + 1 })
      .where(eq(trip.id, existingTrip.id))
      .returning();

    const [newBooking] = await db
      .insert(booking)
      .values({
        tripId: existingTrip.id,
        userId,
        seatNumber: existingTrip.bookedSeats + 1,
        status: "pending",
        paymentStatus: "initialized",
      })
      .returning();

    return newBooking;
  }

  async getAllTrips(user: JWTPayload, date: Date): Promise<Trip[]> {
    const driverId = await this.getDriverId(user);
    const trips = await db.query.trip.findMany({
      where: and(eq(trip.driverId, driverId), eq(trip.date, date)),
    });

    if (!trips) {
      throw createServiceError("No trips found", 404);
    }

    return trips;
  }

  async updateBookingStatus(
    bookingId: string,
    status: "completed" | "cancelled" | "pending" | "confirmed",
  ): Promise<Booking> {
    const bookingExists = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
    });

    if (!bookingExists) {
      throw createServiceError("Booking not found", 404);
    }

    const tripExists = await db.query.trip.findFirst({
      where: eq(trip.id, bookingExists.tripId),
    });

    if (!tripExists) {
      throw createServiceError("Trip not found", 404);
    }

    if (status === "cancelled") {
      await db
        .update(trip)
        .set({ bookedSeats: tripExists.bookedSeats - 1 })
        .where(eq(trip.id, bookingExists.tripId))
        .returning();
    }

    const [updatedBooking] = await db
      .update(booking)
      .set({ status })
      .where(eq(booking.id, bookingId))
      .returning();

    return updatedBooking;
  }

  async syncBookingPaymentStatus(input: {
    bookingId: string;
    paymentReference: string;
    paymentStatus:
      | "initialized"
      | "pending"
      | "successful"
      | "failed"
      | "cancelled"
      | "expired";
  }): Promise<Booking> {
    const bookingExists = await db.query.booking.findFirst({
      where: eq(booking.id, input.bookingId),
    });

    if (!bookingExists) {
      throw createServiceError("Booking not found", 404);
    }

    const nextBookingStatus =
      input.paymentStatus === "successful"
        ? "confirmed"
        : input.paymentStatus === "failed" ||
            input.paymentStatus === "cancelled" ||
            input.paymentStatus === "expired"
          ? "cancelled"
          : "pending";

    if (
      nextBookingStatus === "cancelled" &&
      bookingExists.status !== "cancelled"
    ) {
      const tripExists = await db.query.trip.findFirst({
        where: eq(trip.id, bookingExists.tripId),
      });

      if (tripExists && tripExists.bookedSeats > 0) {
        await db
          .update(trip)
          .set({ bookedSeats: tripExists.bookedSeats - 1 })
          .where(eq(trip.id, bookingExists.tripId))
          .returning();
      }
    }

    const updatePayload: {
      status?: "completed" | "cancelled" | "pending" | "confirmed";
      paymentReference: string;
      paymentStatus: string;
      updatedAt: Date;
    } = {
      paymentReference: input.paymentReference,
      paymentStatus: input.paymentStatus,
      updatedAt: new Date(),
    };

    if (
      !(
        (bookingExists.status === "confirmed" &&
          nextBookingStatus !== "confirmed") ||
        (bookingExists.status === "cancelled" &&
          nextBookingStatus === "pending")
      )
    ) {
      updatePayload.status = nextBookingStatus;
    }

    const [updatedBooking] = await db
      .update(booking)
      .set(updatePayload)
      .where(eq(booking.id, input.bookingId))
      .returning();

    return updatedBooking;
  }

  async updateTripStatus(
    user: JWTPayload,
    tripId: string,
    status: "completed" | "cancelled" | "pending" | "confirmed",
  ): Promise<Trip> {
    const driverId = await this.getDriverId(user);
    const tripExists = await db.query.trip.findFirst({
      where: eq(trip.id, tripId),
    });

    if (!tripExists) {
      throw createServiceError("Trip not found", 404);
    }

    if (tripExists.driverId !== driverId) {
      throw createServiceError(
        "You are not authorized to update this trip",
        403,
      );
    }

    const [updatedTrip] = await db
      .update(trip)
      .set({ status })
      .where(eq(trip.id, tripId))
      .returning();

    await db
      .update(booking)
      .set({ status })
      .where(eq(booking.tripId, tripId))
      .returning();

    return updatedTrip;
  }

  async getUserBookings(userId: string): Promise<Booking[]> {
    return db.query.booking.findMany({
      where: eq(booking.userId, userId),
    });
  }

  async getTripsSummary(
    user: JWTPayload,
    date: Date,
  ): Promise<{
    date: string;
    totalEarnings: number;
    totalTrips: number;
    totalPassengers: number;
    trips: Array<{
      id: string;
      date: Date;
      bookedSeats: number;
      status: string;
      route: {
        id: string;
        pickup_location_title: string;
        dropoff_location_title: string;
        price: number;
      };
      earnings: number;
    }>;
  }> {
    const driverId = await this.getDriverId(user);
    const trips = await db.query.trip.findMany({
      where: and(eq(trip.driverId, driverId), eq(trip.date, date)),
    });

    const tripsWithEarnings = await Promise.all(
      trips.map(async (currentTrip) => {
        const routeData = await db.query.route.findFirst({
          where: eq(route.id, currentTrip.routeId),
        });
        const earnings = currentTrip.bookedSeats * (routeData?.price || 0);

        return {
          id: currentTrip.id,
          date: currentTrip.date,
          bookedSeats: currentTrip.bookedSeats,
          status: currentTrip.status,
          route: {
            id: routeData?.id || "",
            pickup_location_title: routeData?.pickup_location_title || "",
            dropoff_location_title: routeData?.dropoff_location_title || "",
            price: routeData?.price || 0,
          },
          earnings,
        };
      }),
    );

    return {
      date: date.toISOString(),
      totalEarnings: tripsWithEarnings.reduce(
        (sum, item) => sum + item.earnings,
        0,
      ),
      totalTrips: trips.length,
      totalPassengers: tripsWithEarnings.reduce(
        (sum, item) => sum + item.bookedSeats,
        0,
      ),
      trips: tripsWithEarnings,
    };
  }
}
