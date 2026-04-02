import { asyncHandler } from "@shared/middleware";
import { Request, RequestHandler, Response } from "express";
import { RouteService } from "./routeService";
import type { JWTPayload } from "@shared/types";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";

const routeService = new RouteService();
const ALLOWED_VEHICLE_TYPES = new Set(["car", "bus", "luxury_car"]);

function getAuthenticatedUser(req: Request): JWTPayload | null {
  return req.user ?? null;
}

//driver route
export const getAllDriverRoutes: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    const routes = await routeService.getAllDriverRoutes(user);
    return res
      .status(200)
      .json(createSuccessResponse(routes, "Routes fetched successfully"));
  },
);

//driver route
export const createRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    const route = await routeService.createRoute(user, req.body);
    return res
      .status(200)
      .json(createSuccessResponse(route, "Route created successfully"));
  },
);

//driver and user route
export const getRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const routeId = req.params.id as string;
    if (!routeId) {
      return res.status(400).json(createErrorResponse("Route ID is required"));
    }
    const route = await routeService.getRoute(routeId);
    return res
      .status(200)
      .json(createSuccessResponse(route, "Route fetched successfully"));
  },
);

//driver route
export const updateRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    const routeId = req.params.id;
    if (!routeId) {
      return res.status(400).json(createErrorResponse("Route ID is required"));
    }
    const route = await routeService.updateRoute(
      user,
      routeId as string,
      req.body,
    );
    return res
      .status(200)
      .json(createSuccessResponse(route, "Route updated successfully"));
  },
);

//driver route
export const deleteRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const routeId = req.params.id;
    if (!user) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    if (!routeId) {
      return res.status(400).json(createErrorResponse("Route ID is required"));
    }
    const route = await routeService.deleteRoute(user, routeId as string);
    return res
      .status(200)
      .json(createSuccessResponse(route, "Route deleted successfully"));
  },
);

//driver route
export const getAllTrips: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const { date } = req.params;
    if (!user) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    const trips = await routeService.getAllTrips(
      user,
      new Date(date as string),
    );
    return res
      .status(200)
      .json(createSuccessResponse(trips, "Trips fetched successfully"));
  },
);

//driver route
export const getTripsSummary: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const { date } = req.params;
    if (!user) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    const summary = await routeService.getTripsSummary(
      user,
      new Date(date as string),
    );
    return res
      .status(200)
      .json(
        createSuccessResponse(summary, "Trips summary fetched successfully"),
      );
  },
);

//driver route
export const updateTripStatus: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    const tripId = req.params.id;
    if (!tripId) {
      return res.status(400).json(createErrorResponse("Trip ID is required"));
    }
    const trip = await routeService.updateTripStatus(
      user,
      tripId as string,
      req.body.status,
    );
    return res
      .status(200)
      .json(createSuccessResponse(trip, "trip status updated successfully"));
  },
);

//user route
export const getAllUserRoutes: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const routes = await routeService.getAllUserRoutes();
    return res
      .status(200)
      .json(createSuccessResponse(routes, "Routes fetched successfully"));
  },
);

//user route - search routes
export const searchRoutes: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { from, to, vehicleType, limit, offset } = req.query;
    const parsedFrom = typeof from === "string" ? from.trim() : "";
    const parsedTo = typeof to === "string" ? to.trim() : "";
    const parsedVehicleType =
      typeof vehicleType === "string"
        ? vehicleType
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : undefined;
    const parsedLimit = typeof limit === "string" ? parseInt(limit, 10) : 20;
    const parsedOffset = typeof offset === "string" ? parseInt(offset, 10) : 0;

    if (!parsedFrom || !parsedTo) {
      return res
        .status(400)
        .json(createErrorResponse("from and to are required"));
    }

    if (
      parsedVehicleType &&
      parsedVehicleType.some((value) => !ALLOWED_VEHICLE_TYPES.has(value))
    ) {
      return res
        .status(400)
        .json(createErrorResponse("vehicleType contains an invalid value"));
    }

    const routes = await routeService.searchRoutes({
      from: parsedFrom,
      to: parsedTo,
      vehicleType: parsedVehicleType,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    return res
      .status(200)
      .json(createSuccessResponse(routes, "Routes fetched successfully"));
  },
);

//user route
export const bookTrip: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const trip = await routeService.bookTrip(userId as string, req.body);
    return res
      .status(200)
      .json(createSuccessResponse(trip, "Trip booked successfully"));
  },
);

//user route
export const updateBookingStatus: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    const bookingId = req.params.id;
    if (!bookingId) {
      return res
        .status(400)
        .json(createErrorResponse("Booking ID is required"));
    }
    const booking = await routeService.updateBookingStatus(
      bookingId as string,
      req.body.status,
    );
    return res
      .status(200)
      .json(createSuccessResponse(booking, "Booking updated successfully"));
  },
);

//user route
export const getUserBookings: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    const bookings = await routeService.getUserBookings(userId as string);
    return res
      .status(200)
      .json(createSuccessResponse(bookings, "Bookings fetched successfully"));
  },
);
