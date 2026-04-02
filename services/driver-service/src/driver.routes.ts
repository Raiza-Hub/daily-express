import {
  authenticateVerifiedGatewayRequest,
  validateRequest,
} from "@shared/middleware";
import { Router } from "express";
import * as driverController from "./driver.controller";
import { createDriverSchema, updateDriverSchema } from "./validations";
import { cloudinaryMiddleware } from "./cloudinary";

const router: Router = Router();

//Protected routes
router.get(
  "/profile",
  authenticateVerifiedGatewayRequest,
  driverController.getDriver,
);
router.get("/public/:id", driverController.getDriverById);
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

export default router;
