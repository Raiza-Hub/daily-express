import { Request, RequestHandler, Response } from "express";
import { asyncHandler } from "@shared/middleware";
import { DriverService } from "./driverServices";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";

const driverService = new DriverService();

export const getDriver: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const driver = await driverService.getProfile(userId);

    return res
      .status(200)
      .json(
        createSuccessResponse(driver, "Driver profile retrieved successfully"),
      );
  },
);

export const createDriver: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const driverData = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    const driver = await driverService.createDriver(userId, driverData);

    return res
      .status(201)
      .json(
        createSuccessResponse(driver, "Driver profile created successfully"),
      );
  },
);

export const updateDriver: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const driverData = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    const driver = await driverService.updateDriver(userId, driverData);

    return res
      .status(200)
      .json(
        createSuccessResponse(driver, "Driver profile updated successfully"),
      );
  },
);

export const deleteDriver: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }
    await driverService.deleteDriver(userId);

    return res
      .status(200)
      .json(createSuccessResponse(null, "Driver profile deleted successfully"));
  },
);

export const getDriverStats: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const driver = await driverService.getProfile(userId);
    if (!driver) {
      return res.status(404).json(createErrorResponse("Driver not found"));
    }

    const stats = await driverService.getDriverStats(driver.id);

    return res
      .status(200)
      .json(
        createSuccessResponse(stats, "Driver stats retrieved successfully"),
      );
  },
);
