import type { Request, Response, NextFunction } from "express";
import { sendErrorResponse } from "./apiResponses";
import { driverRepository } from "../driver/driver.repository";

export async function requireActiveDriver(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user?.userId as string | undefined;

  if (!userId) {
    sendErrorResponse(res, 401, "Please sign in again to continue.", {
      code: "AUTHENTICATION_REQUIRED",
    });
    return;
  }

  const driverRecord = await driverRepository.findDriverByUserId(userId);

  if (!driverRecord) {
    sendErrorResponse(res, 404, "Driver not found.", {
      code: "DRIVER_NOT_FOUND",
    });
    return;
  }

  if (!driverRecord.isActive) {
    sendErrorResponse(res, 403, "Your account has been deactivated. Please contact support.", {
      code: "DRIVER_DEACTIVATED",
    });
    return;
  }

  next();
}
