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

export const getAllRoutes: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const routes = await timeAsync(
      "admin.routes.service",
      {},
      () => routeCrudService.getAllRoutes(),
    );
    return res
      .status(200)
      .json(createSuccessResponse(routes, "Routes fetched successfully"));
  },
);

export const createRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const route = await timeAsync(
      "admin.create_route.service",
      {},
      () => routeCrudService.createRoute(req.body),
    );
    await recordAdminAudit({
      action: "create_route",
      adminEmail: req.adminUser?.email ?? "unknown",
      target: route.id,

      details: JSON.stringify(req.body),
    });
    return res
      .status(200)
      .json(createSuccessResponse(route, "Route created successfully"));
  },
);

export const updateRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const routeId = getParam(req.params.id);
    if (!routeId) {
      return sendErrorResponse(res, 400, "Route ID is required.", {
        code: "MISSING_ROUTE_ID",
      });
    }
    const route = await timeAsync(
      "admin.update_route.service",
      { routeId },
      () => routeCrudService.updateRoute(routeId, req.body),
    );
    await recordAdminAudit({
      action: "update_route",
      adminEmail: req.adminUser?.email ?? "unknown",
      target: routeId,

      details: JSON.stringify(req.body),
    });
    return res
      .status(200)
      .json(createSuccessResponse(route, "Route updated successfully"));
  },
);

export const deleteRoute: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const routeId = getParam(req.params.id);
    if (!routeId) {
      return sendErrorResponse(res, 400, "Route ID is required.", {
        code: "MISSING_ROUTE_ID",
      });
    }
    await timeAsync(
      "admin.delete_route.service",
      { routeId },
      () => routeCrudService.deleteRoute(routeId),
    );
    await recordAdminAudit({
      action: "delete_route",
      adminEmail: req.adminUser?.email ?? "unknown",
      target: routeId,

    });
    return res
      .status(200)
      .json(createSuccessResponse(null, "Route deactivated successfully"));
  },
);
