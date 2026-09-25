import { Router } from "express";
import { authenticateVerifiedGatewayRequest } from "../middleware/gatewayAuth";
import { createTokenBucketLimiter } from "../middleware/tokenBucket";
import { getConfig } from "../config/index";
import * as routeController from "./route.controller";
import { authenticateSession } from "../middleware/auth";
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

router.get("/origins", routeController.getOrigins);

router.patch(
  "/driver/trip/:id/complete",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  routeController.completeTrip,
);
router.get(
  "/driver/trip/:tripId/bookings",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  routeController.getTripBookings,
);
router.get(
  "/user/bookings",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  routeController.getUserBookings,
);
router.get(
  "/user/bookings/search",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  routeController.searchBookingByRef,
);
router.post(
  "/user/booking/checkout",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  bookingLimiter,
  routeController.createCheckoutBooking,
);

export default router;
