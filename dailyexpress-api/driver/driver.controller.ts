import type { Request, Response, RequestHandler } from "express";
import { asyncHandler } from "@shared/middleware";
import { driverService } from "./driver.service";
import { vehicleService } from "./vehicle.service";
import { driverRepository } from "./driver.repository";
import { createSuccessResponse } from "@shared/utils";
import { getAuthenticatedUser } from "../middleware/auth";
import { sendErrorResponse } from "../middleware/apiResponses";
import { timeAsync } from "../utils/timing";
import type { DriverProfileImageUploadRequest } from "./cloudinary";

function getParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : (value?.[0] ?? null);
}



export const getDriver: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const driver = await timeAsync("driver.profile.service", { userId }, () =>
      driverService.getProfile(userId),
    );

    if (!driver) {
      return res
        .status(200)
        .json(
          createSuccessResponse(null, "Driver profile not found"),
        );
    }

    return res
      .status(200)
      .json(
        createSuccessResponse(driver, "Driver profile retrieved successfully"),
      );
  },
);

export const createDriver: RequestHandler = asyncHandler(
  async (req: DriverProfileImageUploadRequest, res: Response) => {
    const { kycType, kycId, kycConsent: _, ...driverData } = req.body;
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    if (!req.profileImageUpload && !driverData.profile_pic) {
      return sendErrorResponse(res, 400, "Profile photo is required.", {
        code: "MISSING_PROFILE_PHOTO",
      });
    }

    const kycData = kycType && kycId ? { kycType: kycType as "bvn" | "nin", kycId } : undefined;

    const driver = await timeAsync("driver.create.service", { userId }, () =>
      driverService.createDriver(userId, driverData, req.profileImageUpload, kycData),
    );

    return res
      .status(201)
      .json(
        createSuccessResponse(driver, "Driver profile created successfully"),
      );
  },
);

export const updateDriver: RequestHandler = asyncHandler(
  async (req: DriverProfileImageUploadRequest, res: Response) => {
    const { kycType, kycId, kycConsent: _, ...driverData } = req.body;
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const kycData = kycType && kycId ? { kycType: kycType as "bvn" | "nin", kycId } : undefined;

    const driver = await timeAsync("driver.update.service", { userId }, () =>
      driverService.updateDriver(userId, driverData, req.profileImageUpload, kycData),
    );

    return res
      .status(200)
      .json(
        createSuccessResponse(driver, "Driver profile updated successfully"),
      );
  },
);

export const deactivateDriver: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    await timeAsync("driver.deactivate.service", { userId }, () =>
      driverService.deactivateDriver(userId),
    );

    return res
      .status(200)
      .json(createSuccessResponse(null, "Driver profile deactivated successfully"));
  },
);

export const getDriverStats: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const driver = await timeAsync(
      "driver.stats.profile_lookup",
      { userId },
      () => driverService.getProfile(userId),
    );
    if (!driver) {
      return sendErrorResponse(
        res,
        404,
        "We could not find your driver profile.",
        {
          code: "DRIVER_NOT_FOUND",
        },
      );
    }

    const stats = await timeAsync(
      "driver.stats.service",
      { driverId: driver.id },
      () => driverService.getDriverStats(driver.id),
    );

    return res
      .status(200)
      .json(
        createSuccessResponse(stats, "Driver stats retrieved successfully"),
      );
  },
);

// --- Vehicle ---

export const createVehicle: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    const { plateNumber, make, model, capacity, color } = req.body;
    if (!plateNumber || !make || !model || !capacity || !color) {
      return sendErrorResponse(res, 400, "All vehicle fields are required.", {
        code: "MISSING_VEHICLE_FIELDS",
      });
    }
    const driverRecord = await driverRepository.findDriverByUserId(user.userId);
    if (!driverRecord) {
      return sendErrorResponse(res, 404, "Driver not found.", {
        code: "DRIVER_NOT_FOUND",
      });
    }
    const vehicle = await timeAsync(
      "driver.create_vehicle.service",
      { driverId: driverRecord.id },
      () => vehicleService.createVehicle(driverRecord.id, { plateNumber, make, model, capacity, color }),
    );
    return res
      .status(201)
      .json(createSuccessResponse(vehicle, "Vehicle created successfully"));
  },
);

export const getVehicles: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    const driverRecord = await driverRepository.findDriverByUserId(user.userId);
    if (!driverRecord) {
      return sendErrorResponse(res, 404, "Driver not found.", {
        code: "DRIVER_NOT_FOUND",
      });
    }
    const vehicles = await timeAsync(
      "driver.get_vehicles.service",
      { driverId: driverRecord.id },
      () => vehicleService.getVehicles(driverRecord.id),
    );
    return res
      .status(200)
      .json(createSuccessResponse(vehicles, "Vehicles fetched successfully"));
  },
);

export const updateVehicle: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    const vehicleId = getParam(req.params.id);
    if (!vehicleId) {
      return sendErrorResponse(res, 400, "Vehicle ID is required.", {
        code: "MISSING_VEHICLE_ID",
      });
    }
    const driverRecord = await driverRepository.findDriverByUserId(user.userId);
    if (!driverRecord) {
      return sendErrorResponse(res, 404, "Driver not found.", {
        code: "DRIVER_NOT_FOUND",
      });
    }
    const { plateNumber, make, model, capacity, color } = req.body;
    const vehicle = await timeAsync(
      "driver.update_vehicle.service",
      { driverId: driverRecord.id, vehicleId },
      () => vehicleService.updateVehicle(driverRecord.id, vehicleId, { plateNumber, make, model, capacity, color }),
    );
    return res
      .status(200)
      .json(createSuccessResponse(vehicle, "Vehicle updated successfully"));
  },
);

export const deleteVehicle: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    const vehicleId = getParam(req.params.id);
    if (!vehicleId) {
      return sendErrorResponse(res, 400, "Vehicle ID is required.", {
        code: "MISSING_VEHICLE_ID",
      });
    }
    const driverRecord = await driverRepository.findDriverByUserId(user.userId);
    if (!driverRecord) {
      return sendErrorResponse(res, 404, "Driver not found.", {
        code: "DRIVER_NOT_FOUND",
      });
    }
    await timeAsync(
      "driver.delete_vehicle.service",
      { driverId: driverRecord.id, vehicleId },
      () => vehicleService.deleteVehicle(driverRecord.id, vehicleId),
    );
    return res
      .status(200)
      .json(createSuccessResponse(null, "Vehicle deleted successfully"));
  },
);
