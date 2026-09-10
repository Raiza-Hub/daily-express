import { Router } from "express";
import { authenticateVerifiedGatewayRequest } from "../middleware/gatewayAuth";
import { createTokenBucketLimiter } from "../middleware/tokenBucket";
import { getConfig } from "../config/index";
import * as routeController from "./route.controller";
const config = getConfig();

const bookingLimiter = createTokenBucketLimiter({
  capacity: config.TOKEN_BUCKET_BOOKING_CAPACITY,
  refillRate: config.TOKEN_BUCKET_BOOKING_REFILL_RATE,
  refillIntervalSec: config.TOKEN_BUCKET_BOOKING_REFILL_INTERVAL_SEC,
  prefix: "booking",
  message: "Too many booking attempts. Please wait before trying again.",
});

const driverActionLimiter = createTokenBucketLimiter({
  capacity: config.TOKEN_BUCKET_DRIVER_CAPACITY,
  refillRate: config.TOKEN_BUCKET_DRIVER_REFILL_RATE,
  refillIntervalSec: config.TOKEN_BUCKET_DRIVER_REFILL_INTERVAL_SEC,
  prefix: "driver",
  message: "Too many driver actions. Please slow down.",
});

const router: Router = Router();

router.patch(
  "/driver/trip/:id/complete",
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  routeController.completeTrip,
);
router.get(
  "/driver/trip/:tripId/bookings",
  authenticateVerifiedGatewayRequest,
  routeController.getTripBookings,
);
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
  bookingLimiter,
  routeController.createCheckoutBooking,
);

export default router;
