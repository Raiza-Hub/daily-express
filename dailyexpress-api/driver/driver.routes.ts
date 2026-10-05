import { Router } from "express";
import * as driverController from "./driver.controller";
import { authenticateGatewayRequest } from "../middleware/gatewayAuth";
import { requireActiveDriver } from "../middleware/requireActiveDriver";
import { createTokenBucketLimiter } from "../middleware/tokenBucket";
import { getConfig } from "../config/index";
import { validateRequest } from "../middleware/requestValidation";
import { authenticateSession } from "../middleware/auth";
import {
  createDriverSchema,
  updateDriverSchema,
  verifyBankSchema,
  verifyKycSchema,
} from "./validation";

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
  authenticateSession,
  authenticateGatewayRequest,
  driverController.getDriver,
);

router.post(
  "/profile/presign",
  authenticateSession,
  authenticateGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  driverController.presignProfileUpload,
);

router.post(
  "/profile/confirm",
  authenticateSession,
  authenticateGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  driverController.confirmProfileUpload,
);

router.post(
  "/create",
  authenticateSession,
  authenticateGatewayRequest,
  driverActionLimiter,
  validateRequest(createDriverSchema),
  driverController.createDriver,
);

router.post(
  "/verify/bank",
  authenticateSession,
  authenticateGatewayRequest,
  driverActionLimiter,
  validateRequest(verifyBankSchema),
  driverController.verifyBank,
);

router.post(
  "/verify/kyc",
  authenticateSession,
  authenticateGatewayRequest,
  driverActionLimiter,
  validateRequest(verifyKycSchema),
  driverController.verifyKyc,
);

router.put(
  "/update",
  authenticateSession,
  authenticateGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  validateRequest(updateDriverSchema),
  driverController.updateDriver,
);

router.delete(
  "/deactivate",
  authenticateSession,
  authenticateGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  driverController.deactivateDriver,
);

export default router;
