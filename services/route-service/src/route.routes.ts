import { Router } from "express";
import * as routeController from "./route.controller";
import { refreshAndValidateCookie, validateRequest } from "@shared/middleware";
import {
  createRouteSchema,
  createTripSchema,
  updateRouteSchema,
} from "./validation";

const router: Router = Router();

//driver routes
router.get(
  "/driver/routes",
  refreshAndValidateCookie,
  routeController.getAllDriverRoutes,
);
router.post(
  "/driver/routes",
  refreshAndValidateCookie,
  validateRequest(createRouteSchema),
  routeController.createRoute,
);
router.put(
  "/driver/route/:id",
  refreshAndValidateCookie,
  validateRequest(updateRouteSchema),
  routeController.updateRoute,
);
router.patch(
  "/driver/trip/:id",
  refreshAndValidateCookie,
  routeController.updateTripStatus,
);
router.get(
  "/driver/trips/:date",
  refreshAndValidateCookie,
  routeController.getAllTrips,
);
router.delete(
  "/driver/route/:id",
  refreshAndValidateCookie,
  routeController.deleteRoute,
);
router.get("/route/:id", refreshAndValidateCookie, routeController.getRoute);

//user routes
router.post(
  "/user/trip",
  refreshAndValidateCookie,
  validateRequest(createTripSchema),
  routeController.bookTrip,
);
//to be unused for cancelling trips
router.patch(
  "/user/booking/:id",
  refreshAndValidateCookie,
  routeController.updateBookingStatus,
);
router.get(
  "/user/bookings",
  refreshAndValidateCookie,
  routeController.getUserBookings,
);
router.get(
  "/user/routes",
  refreshAndValidateCookie,
  routeController.getAllUserRoutes,
);

export default router;
