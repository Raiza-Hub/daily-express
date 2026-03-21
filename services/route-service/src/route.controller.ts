import { asyncHandler } from "@shared/middleware";
import { Request, Response } from "express";
import { RouteService } from "./routeService";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";
import { string } from "joi";

const routeService = new RouteService();

//driver route
export const getAllDriverRoutes = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const authHeader = req.headers["authorization"] as string;
    const token = authHeader && authHeader.split(" ")[1];
    if (!userId) {
      res.status(401).json(createErrorResponse("User not authenticated"));
    }
    if (!token) {
      res.status(401).json(createErrorResponse("Token not provided"));
    }
    const routes = await routeService.getAllDriverRoutes(token as string);
    res
      .status(200)
      .json(createSuccessResponse(routes, "Routes fetched successfully"));
  },
);

//driver route
export const createRoute = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const authHeader = req.headers["authorization"] as string;
  const token = authHeader && authHeader.split(" ")[1];
  if (!userId) {
    res.status(401).json(createErrorResponse("User not authenticated"));
  }
  if (!token) {
    res.status(401).json(createErrorResponse("Token not provided"));
  }
  const route = await routeService.createRoute(
    userId,
    token as string,
    req.body,
  );
  res
    .status(200)
    .json(createSuccessResponse(route, "Route created successfully"));
});

//driver and user route
export const getRoute = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json(createErrorResponse("User not authenticated"));
  }
  const routeId = req.params.id as string;
  if (!routeId) {
    res.status(400).json(createErrorResponse("Route ID is required"));
  }
  const route = await routeService.getRoute(routeId);
  res
    .status(200)
    .json(createSuccessResponse(route, "Route fetched successfully"));
});

//driver route
export const updateRoute = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const authHeader = req.headers["authorization"] as string;
  const token = authHeader && authHeader.split(" ")[1];
  if (!userId) {
    res.status(401).json(createErrorResponse("User not authenticated"));
  }
  if (!token) {
    res.status(401).json(createErrorResponse("Token not provided"));
  }
  const routeId = req.params.id;
  if (!routeId) {
    res.status(400).json(createErrorResponse("Route ID is required"));
  }
  const route = await routeService.updateRoute(
    token,
    routeId as string,
    req.body,
  );
  res
    .status(200)
    .json(createSuccessResponse(route, "Route updated successfully"));
});

//driver route
export const deleteRoute = asyncHandler(async (req: Request, res: Response) => {
  const routeId = req.params.id;
  const authHeader = req.headers["authorization"] as string;
  const token = authHeader && authHeader.split(" ")[1];
  if (!routeId) {
    res.status(400).json(createErrorResponse("Route ID is required"));
  }
  if (!token) {
    res.status(401).json(createErrorResponse("Token not provided"));
  }
  const route = await routeService.deleteRoute(token, routeId as string);
  res
    .status(200)
    .json(createSuccessResponse(route, "Route deleted successfully"));
});

//driver route
export const getAllTrips = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const authHeader = req.headers["authorization"] as string;
  const token = authHeader && authHeader.split(" ")[1];
  const { date } = req.params;
  if (!userId) {
    res.status(401).json(createErrorResponse("User not authenticated"));
  }
  if (!token) {
    res.status(401).json(createErrorResponse("Token not provided"));
  }
  const trips = await routeService.getAllTrips(token, new Date(date as string));
  res
    .status(200)
    .json(createSuccessResponse(trips, "Trips fetched successfully"));
});

//driver route
export const updateTripStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const authHeader = req.headers["authorization"] as string;
    const token = authHeader && authHeader.split(" ")[1];
    if (!userId) {
      res.status(401).json(createErrorResponse("User not authenticated"));
    }
    if (!token) {
      res.status(401).json(createErrorResponse("Token not provided"));
    }
    const tripId = req.params.id;
    if (!tripId) {
      res.status(400).json(createErrorResponse("Trip ID is required"));
    }
    const trip = await routeService.updateTripStatus(
      token,
      tripId as string,
      req.body.status,
    );
    res
      .status(200)
      .json(createSuccessResponse(trip, "trip status updated successfully"));
  },
);

//user route
export const getAllUserRoutes = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json(createErrorResponse("User not authenticated"));
    }
    const routes = await routeService.getAllUserRoutes();
    res
      .status(200)
      .json(createSuccessResponse(routes, "Routes fetched successfully"));
  },
);

//user route
export const bookTrip = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json(createErrorResponse("User not authenticated"));
  }

  const trip = await routeService.bookTrip(userId, req.body);
  res.status(200).json(createSuccessResponse(trip, "Trip booked successfully"));
});

//user route
export const updateBookingStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json(createErrorResponse("User not authenticated"));
    }
    const bookingId = req.params.id;
    if (!bookingId) {
      res.status(400).json(createErrorResponse("Booking ID is required"));
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
export const getUserBookings = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json(createErrorResponse("User not authenticated"));
    }
    const bookings = await routeService.getUserBookings(userId as string);
    res
      .status(200)
      .json(createSuccessResponse(bookings, "Bookings fetched successfully"));
  },
);
