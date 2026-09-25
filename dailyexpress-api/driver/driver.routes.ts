import { Router } from "express";
import * as driverController from "./driver.controller";
import { authenticateVerifiedGatewayRequest } from "../middleware/gatewayAuth";
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
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverController.getDriver,
);

router.post(
  "/profile/presign",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  driverController.presignProfileUpload,
);

router.post(
  "/profile/confirm",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  driverController.confirmProfileUpload,
);

router.post(
  "/create",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  validateRequest(createDriverSchema),
  driverController.createDriver,
);

router.post(
  "/verify/bank",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  validateRequest(verifyBankSchema),
  driverController.verifyBank,
);

router.post(
  "/verify/kyc",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  driverActionLimiter,
  validateRequest(verifyKycSchema),
  driverController.verifyKyc,
);

router.put(
  "/update",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  validateRequest(updateDriverSchema),
  driverController.updateDriver,
);

router.delete(
  "/deactivate",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  requireActiveDriver,
  driverActionLimiter,
  driverController.deactivateDriver,
);

export default router;
