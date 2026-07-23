import { Router } from "express";
import { asyncHandler } from "@shared/middleware";
import { requireAdminApiKey } from "../middleware/adminAuth";
import { requireAppsmithSignature } from "../middleware/appsmithSignature";
import { sendErrorResponse } from "../middleware/apiResponses";
import { zoneService } from "./zone.service";

function getParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : (value?.[0] ?? null);
}

const router: Router = Router();

router.use(requireAppsmithSignature);

router.get(
  "/",
  requireAdminApiKey,
  asyncHandler(async (req, res) => {
    const zones = await zoneService.getAllZones();
    res.json({ success: true, data: zones });
  }),
);

router.get(
  "/:id",
  requireAdminApiKey,
  asyncHandler(async (req, res) => {
    const id = getParam(req.params.id);
    if (!id) {
      return sendErrorResponse(res, 400, "Zone ID is required");
    }
    const zone = await zoneService.getZoneById(id);
    if (!zone) {
      return sendErrorResponse(res, 404, "Zone not found");
    }
    res.json({ success: true, data: zone });
  }),
);

router.post(
  "/",
  requireAdminApiKey,
  asyncHandler(async (req, res) => {
    const { name, fee } = req.body;
    if (!name || fee === undefined) {
      return sendErrorResponse(res, 400, "Name and fee are required");
    }
    const zone = await zoneService.createZone({ name, fee });
    res.status(201).json({ success: true, data: zone });
  }),
);

router.put(
  "/:id",
  requireAdminApiKey,
  asyncHandler(async (req, res) => {
    const id = getParam(req.params.id);
    if (!id) {
      return sendErrorResponse(res, 400, "Zone ID is required");
    }
    const { name, fee } = req.body;
    const zone = await zoneService.updateZone(id, { name, fee });
    res.json({ success: true, data: zone });
  }),
);

router.delete(
  "/:id",
  requireAdminApiKey,
  asyncHandler(async (req, res) => {
    const id = getParam(req.params.id);
    if (!id) {
      return sendErrorResponse(res, 400, "Zone ID is required");
    }
    await zoneService.deleteZone(id);
    res.json({ success: true, message: "Zone deleted successfully" });
  }),
);

export default router;
