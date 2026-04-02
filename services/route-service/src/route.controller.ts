import { asyncHandler } from "@shared/middleware";
import { Request, RequestHandler, Response } from "express";
import { RouteService } from "./routeService";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";
import { Consumer } from "kafkajs";

let routeService: RouteService;

export const initializeRouteService = (consumer: Consumer) => {
  routeService = new RouteService(consumer);
};

//driver route
export const getAllDriverRoutes: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const authHeader = req.headers["authorization"] as string;
    const token =
      req.cookies?.token || (authHeader && authHeader.split(" ")[1]);
    const cookies = req.headers.cookie || "";
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    if (!token) {
      return res.status(401).json(createErrorResponse("Token not provided"));
    }
    const routes = await routeService.getAllDriverRoutes(cookies);
    res
      .status(200)
      .json(createSuccessResponse(routes, "Routes fetched successfully"));
  },
);

//driver route
export const createRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const authHeader = req.headers["authorization"] as string;
    const token =
      req.cookies?.token || (authHeader && authHeader.split(" ")[1]);
    const cookies = req.headers.cookie || "";
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    if (!token) {
      return res.status(401).json(createErrorResponse("Token not provided"));
    }
    // console.log("userId:", userId, "cookies:", cookies, "req.body:", req.body);
    const route = await routeService.createRoute(
      userId as string,
      cookies,
      req.body,
    );
    res
      .status(200)
      .json(createSuccessResponse(route, "Route created successfully"));
  },
);

//driver and user route
export const getRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    const routeId = req.params.id as string;
    if (!routeId) {
      return res.status(400).json(createErrorResponse("Route ID is required"));
    }
    const route = await routeService.getRoute(routeId);
    res
      .status(200)
      .json(createSuccessResponse(route, "Route fetched successfully"));
  },
);

//driver route
export const updateRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const authHeader = req.headers["authorization"] as string;
    const token =
      req.cookies?.token || (authHeader && authHeader.split(" ")[1]);
    const cookies = req.headers.cookie || "";
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    if (!token) {
      return res.status(401).json(createErrorResponse("Token not provided"));
    }
    const routeId = req.params.id;
    if (!routeId) {
      return res.status(400).json(createErrorResponse("Route ID is required"));
    }
    const route = await routeService.updateRoute(
      cookies,
      routeId as string,
      req.body,
    );
    res
      .status(200)
      .json(createSuccessResponse(route, "Route updated successfully"));
  },
);

//driver route
export const deleteRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const routeId = req.params.id;
    const authHeader = req.headers["authorization"] as string;
    const token =
      req.cookies?.token || (authHeader && authHeader.split(" ")[1]);
    const cookies = req.headers.cookie || "";
    if (!routeId) {
      return res.status(400).json(createErrorResponse("Route ID is required"));
    }
    if (!token) {
      return res.status(401).json(createErrorResponse("Token not provided"));
    }
    const route = await routeService.deleteRoute(cookies, routeId as string);
    res
      .status(200)
      .json(createSuccessResponse(route, "Route deleted successfully"));
  },
);

//driver route
export const getAllTrips: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const authHeader = req.headers["authorization"] as string;
    const token =
      req.cookies?.token || (authHeader && authHeader.split(" ")[1]);
    const cookies = req.headers.cookie || "";
    const { date } = req.params;
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    if (!token) {
      return res.status(401).json(createErrorResponse("Token not provided"));
    }
    const trips = await routeService.getAllTrips(
      cookies,
      new Date(date as string),
    );
    res
      .status(200)
      .json(createSuccessResponse(trips, "Trips fetched successfully"));
  },
);

//driver route
export const updateTripStatus: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const authHeader = req.headers["authorization"] as string;
    const token =
      req.cookies?.token || (authHeader && authHeader.split(" ")[1]);
    const cookies = req.headers.cookie || "";
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    if (!token) {
      return res.status(401).json(createErrorResponse("Token not provided"));
    }
    const tripId = req.params.id;
    if (!tripId) {
      return res.status(400).json(createErrorResponse("Trip ID is required"));
    }
    const trip = await routeService.updateTripStatus(
      cookies,
      tripId as string,
      req.body.status,
    );
    res
      .status(200)
      .json(createSuccessResponse(trip, "trip status updated successfully"));
  },
);

//user route
export const getAllUserRoutes: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    const routes = await routeService.getAllUserRoutes();
    res
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
    res
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
    res
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
    res
      .status(200)
      .json(createSuccessResponse(bookings, "Bookings fetched successfully"));
  },
);
