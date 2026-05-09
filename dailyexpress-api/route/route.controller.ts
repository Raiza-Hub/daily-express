import type { Request, RequestHandler, Response } from "express";
import { asyncHandler } from "@shared/middleware";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";
import { getAuthenticatedUser } from "../middleware/auth";
import { RouteService } from "./routeService";
import { timeAsync } from "../utils/timing";

const routeService = new RouteService();
const ALLOWED_VEHICLE_TYPES = new Set(["car", "bus", "luxury car"]);
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TRIPS_SUMMARY_RANGE_DAYS = 31;

function parseDateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !DATE_ONLY_REGEX.test(value)) {
    return null;
  }

  return value;
}

function dateKeyToUtcMs(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function getParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : value?.[0] ?? null;
}

export const getAllDriverRoutes: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json(createErrorResponse("User not authenticated"));
    }
    const routes = await timeAsync("route.driver_routes.service", {
      userId: user.userId,
    }, () => routeService.getAllDriverRoutes(user));
    return res
      .status(200)
      .json(createSuccessResponse(routes, "Routes fetched successfully"));
  },
);

export const createRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json(createErrorResponse("User not authenticated"));
    }
    const route = await timeAsync("route.create.service", {
      userId: user.userId,
    }, () => routeService.createRoute(user, req.body));
    return res
      .status(200)
      .json(createSuccessResponse(route, "Route created successfully"));
  },
);

export const updateRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json(createErrorResponse("User not authenticated"));
    }
    const routeId = getParam(req.params.id);
    if (!routeId) {
      return res.status(400).json(createErrorResponse("Route ID is required"));
    }
    const route = await timeAsync("route.update.service", {
      userId: user.userId,
      routeId,
    }, () => routeService.updateRoute(user, routeId, req.body));
    return res
      .status(200)
      .json(createSuccessResponse(route, "Route updated successfully"));
  },
);

export const deleteRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const routeId = getParam(req.params.id);
    if (!user) {
      return res.status(401).json(createErrorResponse("User not authenticated"));
    }
    if (!routeId) {
      return res.status(400).json(createErrorResponse("Route ID is required"));
    }
    const route = await timeAsync("route.delete.service", {
      userId: user.userId,
      routeId,
    }, () => routeService.deleteRoute(user, routeId));
    return res
      .status(200)
      .json(createSuccessResponse(route, "Route deleted successfully"));
  },
);

export const getTripsSummaryRange: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const { startDate, endDate } = req.query;
    if (!user) {
      return res.status(401).json(createErrorResponse("User not authenticated"));
    }
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json(createErrorResponse("startDate and endDate are required"));
    }
    if (typeof startDate !== "string" || typeof endDate !== "string") {
      return res
        .status(400)
        .json(createErrorResponse("Dates must be single YYYY-MM-DD values"));
    }

    const parsedStartDate = parseDateOnly(startDate);
    const parsedEndDate = parseDateOnly(endDate);
    if (!parsedStartDate || !parsedEndDate) {
      return res
        .status(400)
        .json(createErrorResponse("Dates must be in YYYY-MM-DD format"));
    }
    if (parsedStartDate > parsedEndDate) {
      return res
        .status(400)
        .json(createErrorResponse("startDate cannot be after endDate"));
    }

    const rangeDays =
      (dateKeyToUtcMs(parsedEndDate) - dateKeyToUtcMs(parsedStartDate)) /
      (24 * 60 * 60 * 1000);
    if (rangeDays > MAX_TRIPS_SUMMARY_RANGE_DAYS) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            `Date range cannot exceed ${MAX_TRIPS_SUMMARY_RANGE_DAYS + 1} days`,
          ),
        );
    }

    const summaries = await timeAsync(
      "route.trips_summary_range.service",
      { userId: user.userId, startDate, endDate },
      () =>
        routeService.getTripsSummaryRange(
          user,
          startDate,
          endDate,
        ),
    );
    return res
      .status(200)
      .json(
        createSuccessResponse(
          summaries,
          "Trips summary range fetched successfully",
        ),
      );
  },
);

export const updateTripStatus: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json(createErrorResponse("User not authenticated"));
    }
    const tripId = getParam(req.params.id);
    if (!tripId) {
      return res.status(400).json(createErrorResponse("Trip ID is required"));
    }
    if (req.body?.status !== "booking_closed") {
      return res
        .status(400)
        .json(createErrorResponse("status must be booking_closed"));
    }
    const trip = await timeAsync(
      "route.update_trip_status.service",
      { userId: user.userId, tripId, status: "booking_closed" },
      () =>
        routeService.updateTripStatus(
          user,
          tripId,
          "booking_closed",
        ),
    );
    return res
      .status(200)
      .json(createSuccessResponse(trip, "trip status updated successfully"));
  },
);

export const searchRoutes: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { from, to, date, vehicleType, limit, offset } = req.query;
    const parsedFrom = typeof from === "string" ? from.trim() : "";
    const parsedTo = typeof to === "string" ? to.trim() : "";
    const parsedDate = typeof date === "string" ? date.trim() : undefined;
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
      return res.status(400).json(createErrorResponse("from and to are required"));
    }
    if (
      parsedVehicleType &&
      parsedVehicleType.some((value) => !ALLOWED_VEHICLE_TYPES.has(value))
    ) {
      return res
        .status(400)
        .json(createErrorResponse("vehicleType contains an invalid value"));
    }

    const routes = await timeAsync(
      "route.search.service",
      {
        hasDate: Boolean(parsedDate),
        vehicleTypeCount: parsedVehicleType?.length ?? 0,
        limit: parsedLimit,
        offset: parsedOffset,
      },
      () =>
        routeService.searchRoutes({
          from: parsedFrom,
          to: parsedTo,
          date: parsedDate,
          vehicleType: parsedVehicleType,
          limit: parsedLimit,
          offset: parsedOffset,
        }),
    );
    return res
      .status(200)
      .json(createSuccessResponse(routes, "Routes fetched successfully"));
  },
);

export const getUserBookings: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthenticatedUser(req)?.userId;
    if (!userId) {
      return res.status(401).json(createErrorResponse("User not authenticated"));
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const result = await timeAsync(
      "route.get_user_bookings.service",
      { userId, limit, offset },
      () => routeService.getUserBookings(userId, limit, offset),
    );
    return res
      .status(200)
      .json(createSuccessResponse(result, "Bookings fetched successfully"));
  },
);

export const searchBookingByRef: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthenticatedUser(req)?.userId;
    const { ref, lastName } = req.query;
    const paymentReference = typeof ref === "string" ? ref : "";
    const lastNameParam = typeof lastName === "string" ? lastName : "";
    if (!userId) {
      return res.status(401).json(createErrorResponse("User not authenticated"));
    }
    if (!paymentReference) {
      return res.status(400).json(createErrorResponse("Reference is required"));
    }
    if (!lastNameParam) {
      return res.status(400).json(createErrorResponse("Last name is required"));
    }

    const booking = await timeAsync(
      "route.search_booking_by_ref.service",
      { userId, hasReference: Boolean(paymentReference) },
      () =>
        routeService.searchBookingByRef(
          userId,
          paymentReference,
          lastNameParam,
        ),
    );
    if (!booking) {
      return res.status(404).json(createErrorResponse("Booking not found"));
    }
    return res
      .status(200)
      .json(createSuccessResponse(booking, "Booking found successfully"));
  },
);

export const getTripBookings: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const tripId = getParam(req.params.tripId);
    if (!user || !tripId) {
      return res.status(401).json(createErrorResponse("User not authenticated"));
    }
    const bookings = await timeAsync(
      "route.trip_bookings.service",
      { userId: user.userId, tripId },
      () => routeService.getTripBookings(user, tripId),
    );
    return res
      .status(200)
      .json(createSuccessResponse(bookings, "Bookings fetched successfully"));
  },
);

export const createBooking: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const { routeId, tripDate } = req.body;
    if (!user) {
      return res.status(401).json(createErrorResponse("User not authenticated"));
    }
    if (!routeId) {
      return res.status(400).json(createErrorResponse("routeId is required"));
    }
    const parsedTripDate = parseDateOnly(tripDate);
    if (!parsedTripDate) {
      return res
        .status(400)
        .json(createErrorResponse("tripDate must be in YYYY-MM-DD format"));
    }
    const booking = await timeAsync(
      "route.create_booking.service",
      { userId: user.userId, routeId, tripDate: parsedTripDate },
      () =>
        routeService.createBooking(user.userId, {
          routeId,
          tripDate: parsedTripDate,
        }),
    );
    return res
      .status(201)
      .json(createSuccessResponse(booking, "Booking created successfully"));
  },
);

export const createCheckoutBooking: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const { routeId, tripDate } = req.body;
    if (!user) {
      return res.status(401).json(createErrorResponse("User not authenticated"));
    }
    if (!routeId) {
      return res.status(400).json(createErrorResponse("routeId is required"));
    }
    const parsedTripDate = parseDateOnly(tripDate);
    if (!parsedTripDate) {
      return res
        .status(400)
        .json(createErrorResponse("tripDate must be in YYYY-MM-DD format"));
    }
    const checkoutBooking = await timeAsync(
      "route.create_checkout_booking.service",
      { userId: user.userId, routeId, tripDate: parsedTripDate },
      () =>
        routeService.createCheckoutBooking(
          user.userId,
          { routeId, tripDate: parsedTripDate },
        ),
    );
    return res
      .status(201)
      .json(
        createSuccessResponse(
          checkoutBooking,
          "Checkout booking created successfully",
        ),
      );
  },
);
