import { asyncHandler } from "@shared/middleware";
import { AuthService } from "./auth.service";
import type { CookieOptions, Request, Response, RequestHandler } from "express";
import { getAuthenticatedUser, getCookieDomain } from "../middleware/auth";
import { createSuccessResponse } from "@shared/utils";
import { sendErrorResponse } from "../middleware/apiResponses";
import { getConfig } from "../config/index";
import {
  clearGoogleOAuthCookies,
  completeGoogleOAuth as completeGoogleOAuthFlow,
  startGoogleOAuth as startGoogleOAuthFlow,
} from "./googleOAuth";

const authService = new AuthService(getConfig());

function clearAuthCookies(res: Response) {
  const cookieDomain = getCookieDomain(getConfig());
  const clearCookieOptions: CookieOptions = cookieDomain
    ? { domain: cookieDomain }
    : {};

  res.clearCookie("token", clearCookieOptions);
  res.clearCookie("refreshToken", clearCookieOptions);
  clearGoogleOAuthCookies(res);
}

export const getProfile: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;
    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const profile = await authService.getUserById(userId);
    if (!profile) {
      return sendErrorResponse(res, 404, "We could not find your account.", {
        code: "USER_NOT_FOUND",
      });
    }

    return res
      .status(200)
      .json(createSuccessResponse(profile, "User profile retrieved"));
  },
);

export const deleteAccount: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    await authService.deleteUser(userId);

    return res
      .status(200)
      .json(createSuccessResponse(null, "Account deleted successfully"));
  },
);

export const logout: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    clearAuthCookies(res);
    res
      .status(200)
      .json(createSuccessResponse(null, "User logged out successfully"));
  },
);

export const updateProfile: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;
    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    const updatedUser = await authService.updateProfile(userId, req.body);

    return res
      .status(200)
      .json(createSuccessResponse(updatedUser, "Profile updated successfully"));
  },
);

export const completeOnboarding: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;
    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const updatedUser = await authService.completeOnboarding(userId, req.body);

    return res
      .status(200)
      .json(
        createSuccessResponse(
          updatedUser,
          "Profile onboarding completed successfully",
        ),
      );
  },
);

export const startGoogleOAuth: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    return res.redirect(startGoogleOAuthFlow(req, res));
  },
);

export const completeGoogleOAuth: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    return res.redirect(await completeGoogleOAuthFlow(req, res));
  },
);