import { Router } from "express";
import * as driverController from "./driver.controller";
import { authenticateVerifiedGatewayRequest } from "../middleware/gatewayAuth";
import { requireActiveDriver } from "../middleware/requireActiveDriver";
import { createTokenBucketLimiter } from "../middleware/tokenBucket";
import { getConfig } from "../config/index";
import { validateRequest } from "../middleware/requestValidation";
import { createDriverSchema, updateDriverSchema } from "./validation";

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
  requireActiveDriver,
  driverController.getDriver,
);

router.post(
  "/profile/presign",
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  driverController.presignProfileUpload,
);

router.post(
  "/profile/confirm",
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  driverController.confirmProfileUpload,
);

router.post(
  "/create",
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  validateRequest(createDriverSchema),
  driverController.createDriver,
);

router.put(
  "/update",
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  validateRequest(updateDriverSchema),
  driverController.updateDriver,
);

router.delete(
  "/deactivate",
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  driverController.deactivateDriver,
);

router.get(
  "/stats",
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverController.getDriverStats,
);

router.get(
  "/vehicles",
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverController.getVehicles,
);
router.post(
  "/vehicles",
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  driverController.createVehicle,
);
router.patch(
  "/vehicles/:id",
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  driverController.updateVehicle,
);
router.delete(
  "/vehicles/:id",
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  driverController.deleteVehicle,
);

export default router;
