import { refreshAndValidateCookie, validateRequest } from "@shared/middleware";
import { Router } from "express";
import * as driverController from "./driver.controller";
import { createDriverSchema, updateDriverSchema } from "./validations";

const router: Router = Router();

//Protected routes
router.get("/profile", refreshAndValidateCookie, driverController.getDriver);
router.post(
  "/create",
  refreshAndValidateCookie,
  validateRequest(createDriverSchema),
  driverController.createDriver,
);
router.put(
  "/update",
  refreshAndValidateCookie,
  validateRequest(updateDriverSchema),
  driverController.updateDriver,
);
router.delete(
  "/profile",
  refreshAndValidateCookie,
  driverController.deleteDriver,
);

export default router;
