import { Router } from "express";
import * as driverController from "./driver.controller";
import { authenticateVerifiedGatewayRequest } from "../middleware/gatewayAuth";
import { validateRequest } from "../middleware/requestValidation";
import { createDriverSchema, updateDriverSchema } from "./validation";
import { cloudinaryMiddleware } from "./cloudinary";

const router: Router = Router();

router.get(
  "/profile",
  authenticateVerifiedGatewayRequest,
  driverController.getDriver,
);

router.post(
  "/create",
  authenticateVerifiedGatewayRequest,
  cloudinaryMiddleware,
  validateRequest(createDriverSchema),
  driverController.createDriver,
);

router.put(
  "/update",
  authenticateVerifiedGatewayRequest,
  cloudinaryMiddleware,
  validateRequest(updateDriverSchema),
  driverController.updateDriver,
);

router.delete(
  "/delete",
  authenticateVerifiedGatewayRequest,
  driverController.deleteDriver,
);

router.get(
  "/stats",
  authenticateVerifiedGatewayRequest,
  driverController.getDriverStats,
);

export default router;
