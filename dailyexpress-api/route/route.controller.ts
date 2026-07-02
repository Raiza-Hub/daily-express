import { asyncHandler } from "@shared/middleware";
import { createSuccessResponse } from "@shared/utils";
import type { Request, RequestHandler, Response } from "express";
import { sendErrorResponse } from "../middleware/apiResponses";
import { getAuthenticatedUser } from "../middleware/auth";
import { timeAsync } from "../utils/timing";
import { routeService } from "./route.service";
import { ALLOWED_VEHICLE_TYPES } from "./utils";
import { sseManager } from "./sse-manager";
import { idempotencyService } from "./idempotency";
const ALLOWED_VEHICLE_TYPES_SET = new Set(ALLOWED_VEHICLE_TYPES);
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
  return typeof value === "string" ? value : (value?.[0] ?? null);
}

export const getDailyTripSummaries: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const { startDate, endDate } = req.query;
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    if (!startDate || !endDate) {
      return sendErrorResponse(
        res,
        400,
        "Start date and end date are required.",
        { code: "MISSING_DATE_RANGE" },
      );
    }
    if (typeof startDate !== "string" || typeof endDate !== "string") {
      return sendErrorResponse(
        res,
        400,
        "Dates must be single YYYY-MM-DD values.",
        { code: "INVALID_DATE_RANGE" },
      );
    }

    const parsedStartDate = parseDateOnly(startDate);
    const parsedEndDate = parseDateOnly(endDate);
    if (!parsedStartDate || !parsedEndDate) {
      return sendErrorResponse(
        res,
        400,
        "Dates must be in YYYY-MM-DD format.",
        { code: "INVALID_DATE_FORMAT" },
      );
    }
    if (parsedStartDate > parsedEndDate) {
      return sendErrorResponse(
        res,
        400,
        "Start date cannot be after end date.",
        { code: "INVALID_DATE_RANGE" },
      );
    }

    const rangeDays =
      (dateKeyToUtcMs(parsedEndDate) - dateKeyToUtcMs(parsedStartDate)) /
      (24 * 60 * 60 * 1000);
    if (rangeDays > MAX_TRIPS_SUMMARY_RANGE_DAYS) {
      return sendErrorResponse(
        res,
        400,
        `Date range cannot exceed ${MAX_TRIPS_SUMMARY_RANGE_DAYS + 1} days.`,
        { code: "DATE_RANGE_TOO_LARGE" },
      );
    }

    const summaries = await timeAsync(
      "route.trips_summary_range.service",
      { userId: user.userId, startDate, endDate },
      () => routeService.getDailyTripSummaries(user, startDate, endDate),
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

export const completeTrip: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    const tripId = getParam(req.params.id);
    if (!tripId) {
      return sendErrorResponse(res, 400, "Trip ID is required.", {
        code: "MISSING_TRIP_ID",
      });
    }

    const trip = await timeAsync(
      "route.complete_trip.service",
      { userId: user.userId, tripId },
      () => routeService.completeTrip(user, tripId),
    );
    return res
      .status(200)
      .json(createSuccessResponse(trip, "Trip completed successfully"));
  },
);

export const searchRoutes: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { from, to, date, limit, cursor, departureTime } = req.query;
    const parsedFrom = typeof from === "string" ? from.trim() : "";
    const parsedTo = typeof to === "string" ? to.trim() : "";
    const parsedDate = typeof date === "string" ? date.trim() : undefined;
    const parsedLimit = typeof limit === "string" ? parseInt(limit, 10) : 20;
    const parsedCursor = typeof cursor === "string" ? cursor : undefined;
    const parsedDepartureTime =
      typeof departureTime === "string" ? departureTime : undefined;

    if (!parsedFrom || !parsedTo) {
      return sendErrorResponse(res, 400, "From and to are required.", {
        code: "MISSING_ROUTE_SEARCH_LOCATIONS",
      });
    }
    if (!parsedDate) {
      return sendErrorResponse(res, 400, "Date is required.", {
        code: "MISSING_ROUTE_SEARCH_DATE",
      });
    }

    const routes = await timeAsync(
      "route.search.service",
      {
        hasDate: Boolean(parsedDate),
        limit: parsedLimit,
        hasCursor: Boolean(parsedCursor),
      },
      () =>
        routeService.searchRoutes({
          from: parsedFrom,
          to: parsedTo,
          date: parsedDate,
          departureTime: parsedDepartureTime,
          limit: parsedLimit,
          cursor: parsedCursor,
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
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const result = await timeAsync(
      "route.get_user_bookings.service",
      { userId, limit, hasCursor: Boolean(cursor) },
      () => routeService.getUserBookings(userId, limit, cursor),
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
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    if (!paymentReference) {
      return sendErrorResponse(res, 400, "Booking reference is required.", {
        code: "MISSING_BOOKING_REFERENCE",
      });
    }
    if (!lastNameParam) {
      return sendErrorResponse(res, 400, "Last name is required.", {
        code: "MISSING_LAST_NAME",
      });
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
      return sendErrorResponse(res, 404, "We could not find that booking.", {
        code: "BOOKING_NOT_FOUND",
      });
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
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    if (!tripId) {
      return sendErrorResponse(res, 400, "Trip ID is required.", {
        code: "MISSING_TRIP_ID",
      });
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

export const createCheckoutBooking: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const { routeId, tripDate, vehicleType } = req.body;
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    if (!routeId) {
      return sendErrorResponse(res, 400, "Route ID is required.", {
        code: "MISSING_ROUTE_ID",
      });
    }
    if (!vehicleType || !ALLOWED_VEHICLE_TYPES_SET.has(vehicleType)) {
      return sendErrorResponse(res, 400, "Valid vehicle type is required (car or bus).", {
        code: "INVALID_VEHICLE_TYPE",
      });
    }
    const parsedTripDate = parseDateOnly(tripDate);
    if (!parsedTripDate) {
      return sendErrorResponse(
        res,
        400,
        "Trip date must be in YYYY-MM-DD format.",
        { code: "INVALID_TRIP_DATE" },
      );
    }

    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (idempotencyKey) {
      const requestHash = idempotencyService.computeRequestHash({ routeId, tripDate: parsedTripDate, vehicleType });
      const cached = await idempotencyService.getCached<unknown>(idempotencyKey, requestHash);
      if (cached === "MISMATCH") {
        return sendErrorResponse(res, 422, "Idempotency key reused with different request parameters.", { code: "IDEMPOTENCY_KEY_MISMATCH" });
      }
      if (cached) {
        return res
          .status(200)
          .json(createSuccessResponse(cached.response, "Checkout booking created successfully"));
      }
    }

    const checkoutBooking = await timeAsync(
      "route.create_checkout_booking.service",
      { userId: user.userId, routeId, tripDate: parsedTripDate, vehicleType },
      () =>
        routeService.createCheckoutBooking(user.userId, {
          routeId,
          tripDate: parsedTripDate,
          vehicleType,
        }),
    );

    if (idempotencyKey) {
      const requestHash = idempotencyService.computeRequestHash({ routeId, tripDate: parsedTripDate, vehicleType });
      await idempotencyService.setCache(idempotencyKey, requestHash, checkoutBooking);
    }

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

export const streamTripUpdates: RequestHandler = (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");
  sseManager.addClient(res);
};

export const getAvailableTrips: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : undefined;
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : undefined;
    const date =
      typeof req.query.date === "string" ? parseDateOnly(req.query.date) : undefined;
    const result = await timeAsync(
      "route.get_available_trips.service",
      { userId: user.userId, limit, hasCursor: Boolean(cursor), hasSearch: Boolean(search), hasDate: Boolean(date) },
      () => routeService.getAvailableTrips(limit, cursor, search, date ?? undefined),
    );
    return res
      .status(200)
      .json(
        createSuccessResponse(result, "Available trips fetched successfully"),
      );
  },
);

export const getAvailableTripsCountByDate: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return sendErrorResponse(res, 400, "Start date and end date are required.", {
        code: "MISSING_DATE_RANGE",
      });
    }
    if (typeof startDate !== "string" || typeof endDate !== "string") {
      return sendErrorResponse(res, 400, "Dates must be single YYYY-MM-DD values.", {
        code: "INVALID_DATE_RANGE",
      });
    }

    const parsedStartDate = parseDateOnly(startDate);
    const parsedEndDate = parseDateOnly(endDate);
    if (!parsedStartDate || !parsedEndDate) {
      return sendErrorResponse(res, 400, "Dates must be in YYYY-MM-DD format.", {
        code: "INVALID_DATE_FORMAT",
      });
    }
    if (parsedStartDate > parsedEndDate) {
      return sendErrorResponse(res, 400, "Start date cannot be after end date.", {
        code: "INVALID_DATE_RANGE",
      });
    }

    const rangeDays =
      (dateKeyToUtcMs(parsedEndDate) - dateKeyToUtcMs(parsedStartDate)) /
      (24 * 60 * 60 * 1000);
    if (rangeDays > 61) {
      return sendErrorResponse(res, 400, "Date range cannot exceed 62 days.", {
        code: "DATE_RANGE_TOO_LARGE",
      });
    }

    const result = await timeAsync(
      "route.get_available_trips_count.service",
      { userId: user.userId, startDate, endDate },
      () => routeService.getAvailableTripsCountByDate(startDate, endDate),
    );
    return res
      .status(200)
      .json(
        createSuccessResponse(result, "Available trips count fetched successfully"),
      );
  },
);

export const claimTrip: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    const tripId = getParam(req.params.id);
    if (!tripId) {
      return sendErrorResponse(res, 400, "Trip ID is required.", {
        code: "MISSING_TRIP_ID",
      });
    }
    const vehicleId: string | undefined = req.body.vehicleId;
    if (!vehicleId) {
      return sendErrorResponse(res, 400, "Vehicle ID is required.", {
        code: "MISSING_VEHICLE_ID",
      });
    }
    const trip = await timeAsync(
      "route.claim_trip.service",
      { userId: user.userId, tripId, vehicleId },
      () => routeService.claimTrip(user, tripId, vehicleId),
    );
    return res
      .status(200)
      .json(createSuccessResponse(trip, "Trip claimed successfully"));
  },
);


