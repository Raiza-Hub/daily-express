import type { Request, Response, RequestHandler } from "express";
import { asyncHandler } from "@shared/middleware";
import { driverService } from "./driver.service";
import { driverRepository } from "./driver.repository";
import { r2ProfileService } from "./r2-profile.service";
import { db } from "../db/connection";
import { createSuccessResponse } from "@shared/utils";
import { getAuthenticatedUser } from "../middleware/auth";
import { sendErrorResponse } from "../middleware/apiResponses";
import { timeAsync } from "../utils/timing";

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
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const driver = await timeAsync("driver.create.service", { userId }, () =>
      driverService.createDriver(userId, req.body),
    );

    return res
      .status(201)
      .json(
        createSuccessResponse(driver, "Driver profile created successfully"),
      );
  },
);

export const verifyBank: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const verified = await timeAsync("driver.verify_bank.service", { userId }, () =>
      driverService.verifyBank(req.body),
    );

    return res
      .status(200)
      .json(
        createSuccessResponse(verified, "Bank account verified successfully"),
      );
  },
);

export const verifyKyc: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const verified = await timeAsync("driver.verify_kyc.service", { userId }, () =>
      driverService.verifyKycIdentity(req.body),
    );

    return res
      .status(200)
      .json(
        createSuccessResponse(verified, "Identity verified successfully"),
      );
  },
);

export const updateDriver: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
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
      driverService.updateDriver(userId, driverData, kycData),
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

// --- Profile Picture (R2 presigned URL) ---

export const presignProfileUpload: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    if (!gatewayUser) {
      return sendErrorResponse(res, 401, "Please sign in again.", { code: "AUTHENTICATION_REQUIRED" });
    }

    const { contentType, contentLength } = req.body;
    if (!contentType || !contentLength) {
      return sendErrorResponse(res, 400, "contentType and contentLength are required.", { code: "MISSING_FIELDS" });
    }

    const driverRecord = await driverRepository.findDriverByUserId(gatewayUser.userId);
    if (!driverRecord) {
      return sendErrorResponse(res, 404, "Driver not found.", {
        code: "DRIVER_NOT_FOUND",
      });
    }

    const result = await r2ProfileService.generateUploadUrl(driverRecord.id, contentType, contentLength);
    return res.status(200).json(createSuccessResponse(result));
  },
);

export const confirmProfileUpload: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    if (!gatewayUser) {
      return sendErrorResponse(res, 401, "Please sign in again.", { code: "AUTHENTICATION_REQUIRED" });
    }

    const { key } = req.body;
    if (!key) {
      return sendErrorResponse(res, 400, "key is required.", { code: "MISSING_KEY" });
    }

    const { publicUrl } = await r2ProfileService.confirmUpload(key);

    await db.transaction(async (tx) => {
      await driverRepository.updateDriver(tx, gatewayUser.userId, {
        profile_pic: publicUrl,
        updatedAt: new Date(),
      });
    });

    return res.status(200).json(
      createSuccessResponse({ profile_pic: publicUrl }, "Profile picture updated successfully"),
    );
  },
);
