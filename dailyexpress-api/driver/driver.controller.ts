import type { Request, Response, RequestHandler } from "express";
import { asyncHandler } from "@shared/middleware";
import { DriverService } from "./driverService";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";
import { getAuthenticatedUser } from "../middleware/auth";
import { timeAsync } from "../utils/timing";
import type { DriverProfileImageUploadRequest } from "./cloudinary";

const driverService = new DriverService();

export const getDriver: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const driver = await timeAsync(
      "driver.profile.service",
      { userId },
      () => driverService.getProfile(userId),
    );

    return res
      .status(200)
      .json(createSuccessResponse(driver, "Driver profile retrieved successfully"));
  },
);

export const createDriver: RequestHandler = asyncHandler(
  async (req: DriverProfileImageUploadRequest, res: Response) => {
    const driverData = req.body;
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    if (!req.profileImageUpload && !driverData.profile_pic) {
      return res
        .status(400)
        .json(createErrorResponse("Profile photo is required"));
    }

    const driver = await timeAsync(
      "driver.create.service",
      { userId },
      () => driverService.createDriver(userId, driverData, req.profileImageUpload),
    );

    return res
      .status(201)
      .json(createSuccessResponse(driver, "Driver profile created successfully"));
  },
);

export const updateDriver: RequestHandler = asyncHandler(
  async (req: DriverProfileImageUploadRequest, res: Response) => {
    const driverData = req.body;
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const driver = await timeAsync(
      "driver.update.service",
      { userId },
      () => driverService.updateDriver(userId, driverData, req.profileImageUpload),
    );

    return res
      .status(200)
      .json(createSuccessResponse(driver, "Driver profile updated successfully"));
  },
);

export const deleteDriver: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    await timeAsync(
      "driver.delete.service",
      { userId },
      () => driverService.deleteDriver(userId),
    );

    return res
      .status(200)
      .json(createSuccessResponse(null, "Driver profile deleted successfully"));
  },
);

export const getDriverStats: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const driver = await timeAsync(
      "driver.stats.profile_lookup",
      { userId },
      () => driverService.getProfile(userId),
    );
    if (!driver) {
      return res.status(404).json(createErrorResponse("Driver not found"));
    }

    const stats = await timeAsync(
      "driver.stats.service",
      { driverId: driver.id },
      () => driverService.getDriverStats(driver.id),
    );

    return res
      .status(200)
      .json(createSuccessResponse(stats, "Driver stats retrieved successfully"));
  },
);
