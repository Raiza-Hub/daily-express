import { asyncHandler } from "@shared/middleware";
import { createSuccessResponse } from "@shared/utils";
import type { Request, RequestHandler, Response } from "express";
import { sendErrorResponse } from "../middleware/apiResponses";
import { recordAdminAudit } from "../middleware/adminAudit";
import { timeAsync } from "../utils/timing";
import { routeCrudService } from "../route/route-crud.service";

function getParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : (value?.[0] ?? null);
}

export const getAllOrigins: RequestHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const origins = await timeAsync(
      "admin.origins.service",
      {},
      () => routeCrudService.getAllOrigins(),
    );
    return res
      .status(200)
      .json(createSuccessResponse(origins, "Origins fetched successfully"));
  },
);

export const createOrigin: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const origin = await timeAsync(
      "admin.create_origin.service",
      {},
      () => routeCrudService.createOrigin(req.body),
    );
    await recordAdminAudit({
      action: "create_origin",
      adminEmail: req.adminUser?.email ?? "unknown",
      target: origin.id,
      details: JSON.stringify(req.body),
    });
    return res
      .status(200)
      .json(createSuccessResponse(origin, "Origin created successfully"));
  },
);

export const updateOrigin: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const originId = getParam(req.params.id);
    if (!originId) {
      return sendErrorResponse(res, 400, "Origin ID is required.", {
        code: "MISSING_ORIGIN_ID",
      });
    }
    const origin = await timeAsync(
      "admin.update_origin.service",
      { originId },
      () => routeCrudService.updateOrigin(originId, req.body),
    );
    await recordAdminAudit({
      action: "update_origin",
      adminEmail: req.adminUser?.email ?? "unknown",
      target: originId,
      details: JSON.stringify(req.body),
    });
    return res
      .status(200)
      .json(createSuccessResponse(origin, "Origin updated successfully"));
  },
);

export const deactivateOrigin: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const originId = getParam(req.params.id);
    if (!originId) {
      return sendErrorResponse(res, 400, "Origin ID is required.", {
        code: "MISSING_ORIGIN_ID",
      });
    }
    await timeAsync(
      "admin.delete_origin.service",
      { originId },
      () => routeCrudService.deactivateOrigin(originId),
    );
    await recordAdminAudit({
      action: "delete_origin",
      adminEmail: req.adminUser?.email ?? "unknown",
      target: originId,
    });
    return res
      .status(200)
      .json(createSuccessResponse(null, "Origin deactivated successfully"));
  },
);

export const getAllDestinations: RequestHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const destinations = await timeAsync(
      "admin.destinations.service",
      {},
      () => routeCrudService.getAllDestinations(),
    );
    return res
      .status(200)
      .json(
        createSuccessResponse(destinations, "Destinations fetched successfully"),
      );
  },
);

export const createDestination: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const destination = await timeAsync(
      "admin.create_destination.service",
      {},
      () => routeCrudService.createDestination(req.body),
    );
    await recordAdminAudit({
      action: "create_destination",
      adminEmail: req.adminUser?.email ?? "unknown",
      target: destination.id,
      details: JSON.stringify(req.body),
    });
    return res
      .status(200)
      .json(
        createSuccessResponse(destination, "Destination created successfully"),
      );
  },
);

export const updateDestination: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const destinationId = getParam(req.params.id);
    if (!destinationId) {
      return sendErrorResponse(res, 400, "Destination ID is required.", {
        code: "MISSING_DESTINATION_ID",
      });
    }
    const destination = await timeAsync(
      "admin.update_destination.service",
      { destinationId },
      () => routeCrudService.updateDestination(destinationId, req.body),
    );
    await recordAdminAudit({
      action: "update_destination",
      adminEmail: req.adminUser?.email ?? "unknown",
      target: destinationId,
      details: JSON.stringify(req.body),
    });
    return res
      .status(200)
      .json(
        createSuccessResponse(destination, "Destination updated successfully"),
      );
  },
);

export const deactivateDestination: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const destinationId = getParam(req.params.id);
    if (!destinationId) {
      return sendErrorResponse(res, 400, "Destination ID is required.", {
        code: "MISSING_DESTINATION_ID",
      });
    }
    await timeAsync(
      "admin.delete_destination.service",
      { destinationId },
      () => routeCrudService.deactivateDestination(destinationId),
    );
    await recordAdminAudit({
      action: "delete_destination",
      adminEmail: req.adminUser?.email ?? "unknown",
      target: destinationId,
    });
    return res
      .status(200)
      .json(
        createSuccessResponse(null, "Destination deactivated successfully"),
      );
  },
);