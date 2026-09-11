import { asyncHandler } from "@shared/middleware";
import { createSuccessResponse } from "@shared/utils";
import type { Request, RequestHandler, Response } from "express";
import { sendErrorResponse } from "../middleware/apiResponses";
import { getAuthenticatedUser } from "../middleware/auth";
import { timeAsync } from "../utils/timing";
import { routeService } from "./route.service";
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

export const searchRoutes: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { origin } = req.query;
    const parsedOrigin = typeof origin === "string" ? origin.trim() : "";

    if (!parsedOrigin) {
      return sendErrorResponse(res, 400, "Origin is required.", {
        code: "MISSING_ROUTE_SEARCH_ORIGIN",
      });
    }

    const routes = await timeAsync(
      "route.search.service",
      { origin: parsedOrigin },
      () => routeService.searchRoutes({ origin: parsedOrigin }),
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
    const {
      routeId,
      tripDate,
      tripType,
      selectedTime,
      boardingPoint,
      passengers,
    } = req.body;
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
    if (tripType !== "departure" && tripType !== "arrival") {
      return sendErrorResponse(
        res,
        400,
        "tripType must be either 'departure' or 'arrival'.",
        { code: "INVALID_TRIP_TYPE" },
      );
    }
    if (typeof selectedTime !== "string" || selectedTime.trim().length === 0) {
      return sendErrorResponse(res, 400, "Selected time is required.", {
        code: "MISSING_SELECTED_TIME",
      });
    }
    if (boardingPoint !== "pickup" && boardingPoint !== "dropoff") {
      return sendErrorResponse(
        res,
        400,
        "boardingPoint must be either 'pickup' or 'dropoff'.",
        { code: "INVALID_BOARDING_POINT" },
      );
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
        routeId,
        tripDate: parsedTripDate,
        tripType,
        selectedTime: selectedTime.trim(),
        boardingPoint,
        passengerCount: passengers.length,
      },
      () =>
        routeService.createCheckoutBooking(user.userId, {
          routeId,
          tripDate: parsedTripDate,
          tripType,
          selectedTime: selectedTime.trim(),
          boardingPoint,
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


