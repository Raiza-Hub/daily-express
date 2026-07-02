import { Router } from "express";
import * as driverController from "./driver.controller";
import { authenticateVerifiedGatewayRequest } from "../middleware/gatewayAuth";
import { createTokenBucketLimiter } from "../middleware/tokenBucket";
import { getConfig } from "../config/index";
import { validateRequest } from "../middleware/requestValidation";
import { createDriverSchema, updateDriverSchema } from "./validation";
import { cloudinaryMiddleware } from "./cloudinary";

const config = getConfig();

const driverActionLimiter = createTokenBucketLimiter({
  capacity: config.TOKEN_BUCKET_DRIVER_CAPACITY,
  refillRate: config.TOKEN_BUCKET_DRIVER_REFILL_RATE,
  refillIntervalSec: config.TOKEN_BUCKET_DRIVER_REFILL_INTERVAL_SEC,
  prefix: "driver",
  message: "Too many driver actions. Please slow down.",
});

const router: Router = Router();

router.get(
  "/profile",
  authenticateVerifiedGatewayRequest,
  driverController.getDriver,
);

router.post(
  "/create",
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  cloudinaryMiddleware,
  validateRequest(createDriverSchema),
  driverController.createDriver,
);

router.put(
  "/update",
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  cloudinaryMiddleware,
  validateRequest(updateDriverSchema),
  driverController.updateDriver,
);

router.delete(
  "/deactivate",
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  driverController.deactivateDriver,
);

router.get(
  "/stats",
  authenticateVerifiedGatewayRequest,
  driverController.getDriverStats,
);

router.get(
  "/vehicles",
  authenticateVerifiedGatewayRequest,
  driverController.getVehicles,
);
router.post(
  "/vehicles",
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  driverController.createVehicle,
);
router.patch(
  "/vehicles/:id",
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  driverController.updateVehicle,
);
router.delete(
  "/vehicles/:id",
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  driverController.deleteVehicle,
);

export default router;
