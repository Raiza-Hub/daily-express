import { Router } from "express";
import { requireAdminApiKey } from "../middleware/adminAuth";
import { requireAppsmithSignature } from "../middleware/appsmithSignature";
import { validateRequest } from "../middleware/requestValidation";
import * as adminController from "./admin.controller";
import { createRouteSchema, updateRouteSchema } from "./validation";

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

export default router;
