import { asyncHandler } from "@shared/middleware";
import { createSuccessResponse } from "@shared/utils";
import type { Request, RequestHandler, Response } from "express";
import { sendErrorResponse } from "../middleware/apiResponses";
import { recordAdminAudit } from "../middleware/adminAudit";
import { timeAsync } from "../utils/timing";
import { routeCrudService } from "../route/route-crud.service";
import { adminTripService } from "./admin-trip.service";

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

export const getPendingTrips: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const trips = await timeAsync(
      "admin.pending_trips.service",
      {},
      () => adminTripService.getPendingTrips(),
    );
    return res
      .status(200)
      .json(
        createSuccessResponse(trips, "Pending trips fetched successfully"),
      );
  },
);

export const getOverdueTrips: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const trips = await timeAsync(
      "admin.overdue_trips.service",
      {},
      () => adminTripService.getOverdueTrips(),
    );
    return res
      .status(200)
      .json(
        createSuccessResponse(trips, "Overdue trips fetched successfully"),
      );
  },
);

export const assignPlatformDriver: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const adminEmail = req.adminUser?.email;
    if (!adminEmail) {
      return sendErrorResponse(res, 401, "Admin authentication required.", {
        code: "ADMIN_AUTHENTICATION_REQUIRED",
      });
    }
    const tripId = getParam(req.params.id);
    if (!tripId) {
      return sendErrorResponse(res, 400, "Trip ID is required.", {
        code: "MISSING_TRIP_ID",
      });
    }
    const { driverId } = req.body;
    if (!driverId) {
      return sendErrorResponse(res, 400, "Driver ID is required.", {
        code: "MISSING_DRIVER_ID",
      });
    }
    const trip = await timeAsync(
      "admin.assign_driver.service",
      { tripId, driverId, adminEmail },
      () => adminTripService.assignPlatformDriver(tripId, driverId, adminEmail),
    );
    await recordAdminAudit({
      action: "assign_platform_driver",
      adminEmail,
      target: tripId,

      details: JSON.stringify({ driverId }),
    });
    return res
      .status(200)
      .json(createSuccessResponse(trip, "Driver assigned successfully"));
  },
);

export const assignExternalDriver: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const adminEmail = req.adminUser?.email;
    if (!adminEmail) {
      return sendErrorResponse(res, 401, "Admin authentication required.", {
        code: "ADMIN_AUTHENTICATION_REQUIRED",
      });
    }
    const tripId = getParam(req.params.id);
    if (!tripId) {
      return sendErrorResponse(res, 400, "Trip ID is required.", {
        code: "MISSING_TRIP_ID",
      });
    }
    const { firstName, lastName, phone, country, state, vehicleMake, vehicleModel, vehiclePlateNumber, vehicleColor, vehicleCapacity } = req.body;
    if (!firstName || !lastName || !phone) {
      return sendErrorResponse(
        res,
        400,
        "First name, last name, and phone are required.",
        { code: "MISSING_EXTERNAL_DRIVER_FIELDS" },
      );
    }
    const result = await timeAsync(
      "admin.assign_external_driver.service",
      { tripId, adminEmail },
      () =>
        adminTripService.assignExternalDriver(tripId, { firstName, lastName, phone, country, state, vehicleMake, vehicleModel, vehiclePlateNumber, vehicleColor, vehicleCapacity }, adminEmail),
    );
    await recordAdminAudit({
      action: "assign_external_driver",
      adminEmail,
      target: tripId,

      details: JSON.stringify({ firstName, lastName, phone }),
    });
    return res
      .status(200)
      .json(
        createSuccessResponse(result, "External driver assigned successfully"),
      );
  },
);

export const refundTripPassengers: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const adminEmail = req.adminUser?.email;
    if (!adminEmail) {
      return sendErrorResponse(res, 401, "Admin authentication required.", {
        code: "ADMIN_AUTHENTICATION_REQUIRED",
      });
    }
    const tripId = getParam(req.params.id);
    if (!tripId) {
      return sendErrorResponse(res, 400, "Trip ID is required.", {
        code: "MISSING_TRIP_ID",
      });
    }
    const reason: "no_driver_found" | "admin_cancelled" | undefined = req.body.reason;
    const result = await timeAsync(
      "admin.refund_trip.service",
      { tripId, adminEmail },
      () => adminTripService.refundTripPassengers(tripId, adminEmail, reason),
    );
    await recordAdminAudit({
      action: "refund_trip_passengers",
      adminEmail,
      target: tripId,

      details: JSON.stringify({ reason }),
    });
    return res
      .status(200)
      .json(createSuccessResponse(result, "Refund processed successfully"));
  },
);
