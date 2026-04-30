import { asyncHandler } from "@shared/middleware";
import { Request, RequestHandler, Response } from "express";
import { RouteService } from "./routeService";
import type { JWTPayload } from "@shared/types";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";

const routeService = new RouteService();
const ALLOWED_VEHICLE_TYPES = new Set(["car", "bus", "luxury_car"]);
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TRIPS_SUMMARY_RANGE_DAYS = 31;

function getAuthenticatedUser(req: Request): JWTPayload | null {
  return req.user ?? null;
}

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

export const getTripsSummaryRange: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const { startDate, endDate } = req.query;
    if (!user) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
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

    const summaries = await routeService.getTripsSummaryRange(
      user,
      startDate,
      endDate,
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

//user route - search routes
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
      date: parsedDate,
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
export const getUserBookings: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;
    const offset = req.query.offset
      ? parseInt(req.query.offset as string, 10)
      : 0;

    const result = await routeService.getUserBookings(
      userId as string,
      limit,
      offset,
    );
    return res
      .status(200)
      .json(createSuccessResponse(result, "Bookings fetched successfully"));
  },
);

//user route - search booking by reference
export const searchBookingByRef: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { ref, lastName } = req.query;
    const paymentReference = typeof ref === "string" ? ref : "";
    const lastNameParam = typeof lastName === "string" ? lastName : "";

    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    if (!paymentReference) {
      return res.status(400).json(createErrorResponse("Reference is required"));
    }
    if (!lastNameParam) {
      return res.status(400).json(createErrorResponse("Last name is required"));
    }

    const booking = await routeService.searchBookingByRef(
      userId as string,
      paymentReference,
      lastNameParam,
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
    const tripId = req.params.tripId as string;
    if (!user || !tripId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    const bookings = await routeService.getTripBookings(user, tripId);
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
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
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

    const booking = await routeService.createBooking(user.userId, {
      routeId,
      tripDate: parsedTripDate,
    });

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
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
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

    const checkoutBooking = await routeService.createCheckoutBooking(
      user.userId,
      {
        routeId,
        tripDate: parsedTripDate,
      },
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

export const compensateCheckoutBooking: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const bookingId =
      typeof req.params.bookingId === "string" ? req.params.bookingId : null;
    const paymentReference =
      typeof req.body?.paymentReference === "string"
        ? req.body.paymentReference
        : bookingId
          ? `checkout-init-failed-${bookingId}`
          : "";

    if (!bookingId) {
      return res.status(400).json(createErrorResponse("bookingId is required"));
    }

    const booking = await routeService.syncBookingPaymentStatus({
      bookingId,
      paymentReference,
      paymentStatus: "failed",
    });

    return res
      .status(200)
      .json(createSuccessResponse(booking, "Booking compensation completed"));
  },
);
