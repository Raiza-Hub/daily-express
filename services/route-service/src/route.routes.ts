import { Router } from "express";
import * as routeController from "./route.controller";
import {
  authenticateInternalServiceRequest,
  authenticateVerifiedGatewayRequest,
  validateRequest,
} from "@shared/middleware";
import { createRouteSchema, updateRouteSchema } from "./validation";

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
  "/driver/trips-summary-range",
  authenticateVerifiedGatewayRequest,
  routeController.getTripsSummaryRange,
);
router.delete(
  "/driver/route/:id",
  authenticateVerifiedGatewayRequest,
  routeController.deleteRoute,
);
router.get(
  "/driver/trip/:tripId/bookings",
  authenticateVerifiedGatewayRequest,
  routeController.getTripBookings,
);

//user routes
router.get(
  "/user/bookings",
  authenticateVerifiedGatewayRequest,
  routeController.getUserBookings,
);
router.get(
  "/user/bookings/search",
  authenticateVerifiedGatewayRequest,
  routeController.searchBookingByRef,
);

router.get("/search", routeController.searchRoutes);

router.post(
  "/user/booking/checkout",
  authenticateVerifiedGatewayRequest,
  routeController.createCheckoutBooking,
);
router.post(
  "/internal/bookings/:bookingId/compensate-checkout",
  authenticateInternalServiceRequest,
  routeController.compensateCheckoutBooking,
);

export default router;
