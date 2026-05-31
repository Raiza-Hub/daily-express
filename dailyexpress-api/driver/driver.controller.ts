import type { Request, Response, RequestHandler } from "express";
import { asyncHandler } from "@shared/middleware";
import { DriverService } from "./driverService";
import { createSuccessResponse } from "@shared/utils";
import { getAuthenticatedUser } from "../middleware/auth";
import { sendErrorResponse } from "../middleware/apiResponses";
import { timeAsync } from "../utils/timing";
import type { DriverProfileImageUploadRequest } from "./cloudinary";

const driverService = new DriverService();

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

    return res
      .status(200)
      .json(
        createSuccessResponse(driver, "Driver profile retrieved successfully"),
      );
  },
);

export const createDriver: RequestHandler = asyncHandler(
  async (req: DriverProfileImageUploadRequest, res: Response) => {
    const driverData = req.body;
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

    const driver = await timeAsync("driver.create.service", { userId }, () =>
      driverService.createDriver(userId, driverData, req.profileImageUpload),
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
    const driverData = req.body;
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const driver = await timeAsync("driver.update.service", { userId }, () =>
      driverService.updateDriver(userId, driverData, req.profileImageUpload),
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
