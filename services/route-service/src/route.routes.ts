import { Router } from "express";
import * as routeController from "./route.controller";
import { authenticateToken, validateRequest } from "@shared/middleware";
import {
  createRouteSchema,
  createTripSchema,
  updateRouteSchema,
} from "./validation";

const router = Router();

//driver routes
router.get(
  "/driver/routes",
  authenticateToken,
  routeController.getAllDriverRoutes,
);
router.post(
  "/driver/routes",
  authenticateToken,
  validateRequest(createRouteSchema),
  routeController.createRoute,
);
router.put(
  "/driver/route/:id",
  authenticateToken,
  validateRequest(updateRouteSchema),
  routeController.updateRoute,
);
router.patch(
  "/driver/trip/:id",
  authenticateToken,
  routeController.updateTripStatus,
);
router.get(
  "/driver/trips/:date",
  authenticateToken,
  routeController.getAllTrips,
);
router.delete(
  "/driver/route/:id",
  authenticateToken,
  routeController.deleteRoute,
);
router.get("/route/:id", authenticateToken, routeController.getRoute);

//user routes
router.post(
  "/user/trip",
  authenticateToken,
  validateRequest(createTripSchema),
  routeController.bookTrip,
);
//to be unused for cancelling trips
router.patch(
  "/user/booking/:id",
  authenticateToken,
  routeController.updateBookingStatus,
);
router.get(
  "/user/bookings",
  authenticateToken,
  routeController.getUserBookings,
);
router.get("/user/routes", authenticateToken, routeController.getAllUserRoutes);

export default router;
