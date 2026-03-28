import { AuthClient } from "./authClient";
import axios from "axios";
import { db } from "../db/db";
import {
  Booking,
  CreateRoute,
  CreateTrip,
  Route,
  ServiceResponse,
  Trip,
  updateBookingRequest,
  updateRouteRequest,
} from "@shared/types";
import { createServiceError } from "@shared/utils";
import { booking, route, trip } from "db/schema";
import { and, eq } from "drizzle-orm";

export class RouteService {
  private authClient: AuthClient;
  private readonly driverServiceUrl: string;

  constructor() {
    this.authClient = new AuthClient();
    this.driverServiceUrl =
      process.env.DRIVER_SERVICE_URL || "http://localhost:3002/v1/driver";
  }

  private async getDriverId(token: string): Promise<string> {
    try {
      const response = await axios.get<ServiceResponse<{ id: string }>>(
        `${this.driverServiceUrl}/v1/driver/profile`, // Removed the ${userId}
        {
          headers: {
            Cookie: token,
          },
        },
      );
      if (!response.data.success || !response.data.data) {
        throw createServiceError("Invalid token response...", 401);
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

      if (error instanceof Error && (error as any).code === "ECONNREFUSED") {
        throw createServiceError("Driver service is offline", 502);
      }

      throw createServiceError(
        "An unexpected error occurred in RouteService",
        500,
      );
    }
  }

  async createRoute(
    userId: string,
    token: string,
    routeData: CreateRoute,
  ): Promise<Route> {
    const driverId = await this.getDriverId(token);
    if (!driverId) {
      throw createServiceError("This Route is only accessible by driver", 403);
    }

    //check if route already exists using pickup details and drop off details
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

    //create a new route
    const [newRoute] = await db
      .insert(route)
      .values({ ...routeData, driverId })
      .returning();

    return newRoute;
  }

  async getAllDriverRoutes(token: string): Promise<Route[]> {
    const driverId = await this.getDriverId(token);
    if (!driverId) {
      throw createServiceError("This Route is only accessible by driver", 403);
    }
    const allRoutes = await db.query.route.findMany({
      where: eq(route.driverId, driverId),
    });
    return allRoutes;
  }
  async getAllUserRoutes(): Promise<Route[]> {
    const allRoutes = await db.query.route.findMany();
    return allRoutes;
  }
  async getRoute(routeId: string): Promise<Route> {
    const routes = await db.query.route.findFirst({
      where: eq(route.id, routeId),
    });
    if (!routes) {
      throw createServiceError("Route not found", 404);
    }
    return routes;
  }
  async updateRoute(
    token: string,
    routeId: string,
    routeData: updateRouteRequest,
  ): Promise<Route> {
    const driverId = await this.getDriverId(token);
    if (!driverId) {
      throw createServiceError("This Route is only accessible by driver", 403);
    }
    const routes = await db.query.route.findFirst({
      where: eq(route.id, routeId),
    });
    if (!routes) {
      throw createServiceError("Route not found", 404);
    }
    const [updatedRoute] = await db
      .update(route)
      .set(routeData)
      .where(eq(route.id, routeId))
      .returning();
    return updatedRoute;
  }
  async deleteRoute(token: string, routeId: string): Promise<void> {
    const driverId = await this.getDriverId(token);
    if (!driverId) {
      throw createServiceError("This Route is only accessible by driver", 403);
    }
    const routes = await db.query.route.findFirst({
      where: eq(route.id, routeId),
    });
    if (!routes) {
      throw createServiceError("Route not found", 404);
    }
    await db.delete(route).where(eq(route.id, routeId));
  }

  async bookTrip(userId: string, tripData: CreateTrip): Promise<Booking> {
    //check if route exists
    const route = await this.getRoute(tripData.routeId);
    if (!route) {
      throw createServiceError("Route not found", 404);
    }
    //check if trip already exists
    const existingTrip = await db.query.trip.findFirst({
      where: and(
        eq(trip.routeId, tripData.routeId),
        eq(trip.date, tripData.date),
      ),
    });
    if (existingTrip) {
      //check trip status
      if (existingTrip.status === "completed") {
        throw createServiceError("Trip already completed", 400);
      }
      if (existingTrip.status === "cancelled") {
        throw createServiceError("Trip already cancelled", 400);
      }
      if (existingTrip.status === "confirmed") {
        throw createServiceError("Trip already confirmed", 400);
      }
      if (existingTrip.bookedSeats >= route.availableSeats) {
        throw createServiceError("Trip is full", 400);
      }
      if (existingTrip.status === "pending") {
        //update trip booked seats
        const [updatedTrip] = await db
          .update(trip)
          .set({ bookedSeats: existingTrip.bookedSeats + 1 })
          .where(eq(trip.id, existingTrip.id))
          .returning();

        //and create booking for the user
        const [newBooking] = await db
          .insert(booking)
          .values({
            tripId: existingTrip.id,
            userId,
            seatNumber: existingTrip.bookedSeats + 1,
            status: "pending",
          })
          .returning();

        //

        return newBooking;
      }

      throw createServiceError("Invalid trip status", 400);
    } else {
      //create trip because it doesn't exist
      const [newTrip] = await db
        .insert(trip)
        .values({
          ...tripData,
          driverId: route.driverId,
          capacity: route.availableSeats,
          bookedSeats: 1,
          status: "pending",
        })
        .returning();

      //create booking for the user
      const [newBooking] = await db
        .insert(booking)
        .values({
          tripId: newTrip.id,
          userId,
          seatNumber: 1,
          status: "pending",
        })
        .returning();

      return newBooking;
    }
  }

  async getAllTrips(token: string, date: Date): Promise<Trip[]> {
    const driverId = await this.getDriverId(token);
    if (!driverId) {
      throw createServiceError("This Route is only accessible by driver", 403);
    }
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
      //update trip booked seats
      const [updatedTrip] = await db
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

  async updateTripStatus(
    token: string,
    tripId: string,
    status: "completed" | "cancelled" | "pending" | "confirmed",
  ): Promise<Trip> {
    const driverId = await this.getDriverId(token);
    if (!driverId) {
      throw createServiceError("This Route is only accessible by driver", 403);
    }
    console.log(tripId);
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
    //update trip status
    const [updatedTrip] = await db
      .update(trip)
      .set({ status })
      .where(eq(trip.id, tripId))
      .returning();

    //update booking status
    const [updatedBooking] = await db
      .update(booking)
      .set({ status })
      .where(eq(booking.tripId, tripId))
      .returning();

    return updatedTrip;
  }

  //should i add specific check for only pending
  async getUserBookings(userId: string): Promise<Booking[]> {
    const bookings = await db.query.booking.findMany({
      where: eq(booking.userId, userId),
    });
    return bookings;
  }
}
