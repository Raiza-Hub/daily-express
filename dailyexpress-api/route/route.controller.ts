import { asyncHandler } from "@shared/middleware";
import { createSuccessResponse } from "@shared/utils";
import type { Request, RequestHandler, Response } from "express";
import { sendErrorResponse } from "../middleware/apiResponses";
import { getAuthenticatedUser } from "../middleware/auth";
import { timeAsync } from "../utils/timing";
import { routeService } from "./route.service";
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_REGEX = /^\d{4}$/;
const BOOKING_STATUS_FILTERS = [
  "confirmed",
  "refunded",
  "refund_pending",
  "refund_failed",
] as const;

function parseYear(value: unknown): number | undefined {
  const raw = getParam(value as string | string[] | undefined);
  if (!raw || !YEAR_REGEX.test(raw)) return undefined;
  return Number(raw);
}

function parseBookingStatusFilter(
  value: unknown,
): (typeof BOOKING_STATUS_FILTERS)[number] | undefined {
  const raw = getParam(value as string | string[] | undefined);
  return BOOKING_STATUS_FILTERS.find((s) => s === raw);
}

function parseDateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !DATE_ONLY_REGEX.test(value)) {
    return null;
  }

  return value;
}

function getParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : (value?.[0] ?? null);
}

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

export const getOrigins: RequestHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const origins = await timeAsync(
      "route.origins.service",
      {},
      () => routeService.getOrigins(),
    );
    return res
      .status(200)
      .json(createSuccessResponse(origins, "Origins fetched successfully"));
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
    const year = parseYear(req.query.year);
    const status = parseBookingStatusFilter(req.query.status);
    const result = await timeAsync(
      "route.get_user_bookings.service",
      { userId, limit, hasCursor: Boolean(cursor), year, status },
      () => routeService.getUserBookings(userId, limit, cursor, { year, status }),
    );
    return res
      .status(200)
      .json(createSuccessResponse(result, "Bookings fetched successfully"));
  },
);

export const getTripPassengers: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const tripId = getParam(req.params.id);
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
    const result = await timeAsync(
      "route.trip_passengers.service",
      { userId: user.userId, tripId },
      () => routeService.getTripPassengers(user, tripId),
    );
    return res
      .status(200)
      .json(createSuccessResponse(result, "Passengers fetched successfully"));
  },
);

export const getBookingPassengers: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const bookingId = getParam(req.params.id);
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    if (!bookingId) {
      return sendErrorResponse(res, 400, "Booking ID is required.", {
        code: "MISSING_BOOKING_ID",
      });
    }
    const result = await timeAsync(
      "route.booking_passengers.service",
      { userId: user.userId, bookingId },
      () => routeService.getBookingPassengers(user, bookingId),
    );
    return res
      .status(200)
      .json(createSuccessResponse(result, "Passengers fetched successfully"));
  },
);

export const createCheckoutBooking: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const {
      originId,
      destinationId,
      tripDate,
      departureTime,
      passengers,
    } = req.body;
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    if (!originId) {
      return sendErrorResponse(res, 400, "Origin ID is required.", {
        code: "MISSING_ORIGIN_ID",
      });
    }
    if (!destinationId) {
      return sendErrorResponse(res, 400, "Destination ID is required.", {
        code: "MISSING_DESTINATION_ID",
      });
    }
    if (typeof departureTime !== "string" || departureTime.trim().length === 0) {
      return sendErrorResponse(res, 400, "Selected time is required.", {
        code: "MISSING_SELECTED_TIME",
      });
    }
    if (!Array.isArray(passengers) || passengers.length < 1 || passengers.length > 4) {
      return sendErrorResponse(
        res,
        400,
        "Passengers are required (1 to 4 travelers).",
        { code: "INVALID_PASSENGERS" },
      );
    }
    for (const passenger of passengers) {
      if (
        typeof passenger !== "object" ||
        passenger === null ||
        typeof passenger.fullName !== "string" ||
        passenger.fullName.trim().length === 0 ||
        typeof passenger.email !== "string" ||
        passenger.email.trim().length === 0 ||
        typeof passenger.phone !== "string" ||
        passenger.phone.trim().length === 0 ||
        typeof passenger.carriesLuggage !== "boolean"
      ) {
        return sendErrorResponse(
          res,
          400,
          "Each passenger needs fullName, email, phone and carriesLuggage.",
          { code: "INVALID_PASSENGERS" },
        );
      }
    }
    const seenEmails = new Set<string>();
    for (const passenger of passengers) {
      const normalizedEmail = passenger.email.trim().toLowerCase();
      if (seenEmails.has(normalizedEmail)) {
        return sendErrorResponse(
          res,
          400,
          "Each passenger must have a unique email address.",
          { code: "INVALID_PASSENGERS" },
        );
      }
      seenEmails.add(normalizedEmail);
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

    const checkoutBooking = await timeAsync(
      "route.create_checkout_booking.service",
      {
        userId: user.userId,
        originId,
        destinationId,
        tripDate: parsedTripDate,
        departureTime: departureTime.trim(),
        passengerCount: passengers.length,
      },
      () =>
        routeService.createCheckoutBooking(user.userId, {
          originId,
          destinationId,
          tripDate: parsedTripDate,
          departureTime: departureTime.trim(),
          passengers: passengers.map((passenger) => ({
            fullName: passenger.fullName.trim(),
            email: passenger.email.trim(),
            phone: passenger.phone.trim(),
            carriesLuggage: passenger.carriesLuggage,
          })),
        }),
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

export const getDriverTrips: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    const from = parseDateOnly(req.query.from);
    const to = parseDateOnly(req.query.to);
    if (!from || !to || from > to) {
      return sendErrorResponse(res, 400, "A valid date range is required.", {
        code: "INVALID_DATE_RANGE",
      });
    }
    const trips = await timeAsync(
      "route.driver_trips.service",
      { userId: user.userId, from, to },
      () => routeService.getDriverTrips(user, from, to),
    );
    return res
      .status(200)
      .json(createSuccessResponse(trips, "Driver trips fetched successfully"));
  },
);

export const cancelTrip: RequestHandler = asyncHandler(
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
      "route.cancel_trip.service",
      { userId: user.userId, tripId },
      () => routeService.cancelTrip(user, tripId),
    );
    return res
      .status(200)
      .json(createSuccessResponse(trip, "Trip cancelled successfully"));
  },
);

export const initiatePayout: RequestHandler = asyncHandler(
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
      "route.initiate_payout.service",
      { userId: user.userId, tripId },
      () => routeService.initiateTripPayout(user, tripId),
    );
    return res
      .status(200)
      .json(createSuccessResponse(trip, "Payout initiated successfully"));
  },
);
