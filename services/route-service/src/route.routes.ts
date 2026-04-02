import { Router } from "express";
import * as routeController from "./route.controller";
import {
  authenticateVerifiedGatewayRequest,
  validateRequest,
} from "@shared/middleware";
import {
  createRouteSchema,
  createTripSchema,
  updateRouteSchema,
} from "./validation";

const router: Router = Router();

//driver routes
router.get(
  "/driver/routes",
  authenticateVerifiedGatewayRequest,
  routeController.getAllDriverRoutes,
);
router.post(
  "/create/driver/route",
  authenticateVerifiedGatewayRequest,
  validateRequest(createRouteSchema),
  routeController.createRoute,
);
router.put(
  "/update/driver/route/:id",
  authenticateVerifiedGatewayRequest,
  validateRequest(updateRouteSchema),
  routeController.updateRoute,
);
router.patch(
  "/driver/trip/:id",
  authenticateVerifiedGatewayRequest,
  routeController.updateTripStatus,
);
router.get(
  "/driver/trips/:date",
  authenticateVerifiedGatewayRequest,
  routeController.getAllTrips,
);
router.get(
  "/driver/trips-summary/:date",
  authenticateVerifiedGatewayRequest,
  routeController.getTripsSummary,
);
router.delete(
  "/driver/route/:id",
  authenticateVerifiedGatewayRequest,
  routeController.deleteRoute,
);
router.get("/get/:id", routeController.getRoute);

//user routes
router.post(
  "/user/trip",
  authenticateVerifiedGatewayRequest,
  validateRequest(createTripSchema),
  routeController.bookTrip,
);
//to be unused for cancelling trips
router.patch(
  "/user/booking/:id",
  authenticateVerifiedGatewayRequest,
  routeController.updateBookingStatus,
);
router.get(
  "/user/bookings",
  authenticateVerifiedGatewayRequest,
  routeController.getUserBookings,
);
router.get("/user/routes", routeController.getAllUserRoutes);
router.get("/search", routeController.searchRoutes);

export default router;
