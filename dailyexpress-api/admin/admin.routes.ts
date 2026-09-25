import { Router } from "express";
import { requireAdminApiKey } from "../middleware/adminAuth";
import { requireAppsmithSignature } from "../middleware/appsmithSignature";
import { validateRequest } from "../middleware/requestValidation";
import * as adminController from "./admin.controller";
import {
  createOriginSchema,
  updateOriginSchema,
  createDestinationSchema,
  updateDestinationSchema,
} from "./validation";

const router: Router = Router();

router.use(requireAppsmithSignature);

router.get("/origins", requireAdminApiKey, adminController.getAllOrigins);

router.post(
  "/origins",
  requireAdminApiKey,
  validateRequest(createOriginSchema),
  adminController.createOrigin,
);

router.put(
  "/origins/:id",
  requireAdminApiKey,
  validateRequest(updateOriginSchema),
  adminController.updateOrigin,
);

router.delete(
  "/origins/:id",
  requireAdminApiKey,
  adminController.deactivateOrigin,
);

router.get(
  "/destinations",
  requireAdminApiKey,
  adminController.getAllDestinations,
);

router.post(
  "/destinations",
  requireAdminApiKey,
  validateRequest(createDestinationSchema),
  adminController.createDestination,
);

router.put(
  "/destinations/:id",
  requireAdminApiKey,
  validateRequest(updateDestinationSchema),
  adminController.updateDestination,
);

router.delete(
  "/destinations/:id",
  requireAdminApiKey,
  adminController.deactivateDestination,
);

export default router;