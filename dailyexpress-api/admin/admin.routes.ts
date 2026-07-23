import { Router } from "express";
import { requireAdminApiKey } from "../middleware/adminAuth";
import { requireAppsmithSignature } from "../middleware/appsmithSignature";
import { validateRequest } from "../middleware/requestValidation";
import * as adminController from "./admin.controller";
import { createRouteSchema, updateRouteSchema } from "./validation";
import zoneRoutes from "../zone/zone.api";

const router: Router = Router();

router.use(requireAppsmithSignature);

router.get("/",
  requireAdminApiKey,
  adminController.getAllRoutes
);

router.post(
  "/route/create",
  requireAdminApiKey,
  validateRequest(createRouteSchema),
  adminController.createRoute,
);

router.put(
  "/route/:id",
  requireAdminApiKey,
  validateRequest(updateRouteSchema),
  adminController.updateRoute,
);

router.delete(
  "/route/:id",
  requireAdminApiKey,
  adminController.deleteRoute,
);

router.get(
  "/trips/pending",
  requireAdminApiKey,
  adminController.getPendingTrips,
);

router.get(
  "/trips/overdue",
  requireAdminApiKey,
  adminController.getOverdueTrips,
);

router.post(
  "/trip/:id/assign-driver",
  requireAdminApiKey,
  adminController.assignPlatformDriver,
);

router.post(
  "/trip/:id/assign-external",
  requireAdminApiKey,
  adminController.assignExternalDriver,
);

router.post(
  "/trip/:id/refund",
  requireAdminApiKey,
  adminController.refundTripPassengers,
);

router.use("/zones", zoneRoutes);

export default router;
