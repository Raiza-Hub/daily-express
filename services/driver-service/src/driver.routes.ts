import { authenticateToken, validateRequest } from "@shared/middleware";
import { Router } from "express";
import * as driverController from "./driver.controller";
import { createDriverSchema, updateDriverSchema } from "./validations";

const router = Router();

//Protected routes
router.get("/profile", authenticateToken, driverController.getDriver);
router.post(
  "/create",
  authenticateToken,
  validateRequest(createDriverSchema),
  driverController.createDriver,
);
router.put(
  "/update",
  authenticateToken,
  validateRequest(updateDriverSchema),
  driverController.updateDriver,
);
router.delete("/profile", authenticateToken, driverController.deleteDriver);

export default router;
