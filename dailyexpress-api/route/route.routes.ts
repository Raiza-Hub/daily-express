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
  "/driver/trips",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  routeController.getDriverTrips,
);
router.patch(
  "/driver/trip/:id/cancel",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  routeController.cancelTrip,
);
router.post(
  "/driver/trip/:id/payout",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  routeController.initiatePayout,
);
router.get(
  "/driver/trip/:id/passengers",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  routeController.getTripPassengers,
);
router.get(
  "/user/booking/:id/passengers",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  routeController.getBookingPassengers,
);
router.get(
  "/user/bookings",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  routeController.getUserBookings,
);

router.post(
  "/user/booking/checkout",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  bookingLimiter,
  routeController.createCheckoutBooking,
);

export default router;
