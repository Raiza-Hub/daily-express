import { asyncHandler } from "@shared/middleware";
import { AuthService } from "./authService";
import type { CookieOptions, Request, Response, RequestHandler } from "express";
import { getAuthenticatedUser } from "../middleware/auth";
import { createSuccessResponse } from "@shared/utils";
import { sendErrorResponse } from "../middleware/apiResponses";
import {
  clearGoogleOAuthCookies,
  completeGoogleOAuth as completeGoogleOAuthFlow,
  startGoogleOAuth as startGoogleOAuthFlow,
} from "./googleOAuth";

const authService = new AuthService();
const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function getCookieDomain() {
  if (process.env.NODE_ENV !== "production") {
    return undefined;
  }

  return process.env.COOKIE_DOMAIN || ".dailyexpress.app";
}

function getCookieOptions(maxAge: number): CookieOptions {
  const cookieDomain = getCookieDomain();

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
}

function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
) {
  res.cookie(
    "token",
    tokens.accessToken,
    getCookieOptions(ACCESS_TOKEN_MAX_AGE),
  );
  res.cookie(
    "refreshToken",
    tokens.refreshToken,
    getCookieOptions(REFRESH_TOKEN_MAX_AGE),
  );
}

function clearAuthCookies(res: Response) {
  const cookieDomain = getCookieDomain();
  const clearCookieOptions: CookieOptions = cookieDomain
    ? { domain: cookieDomain }
    : {};

  res.clearCookie("token", clearCookieOptions);
  res.clearCookie("refreshToken", clearCookieOptions);
  clearGoogleOAuthCookies(res);
}

export const register: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password, firstName, lastName, dateOfBirth } = req.body;
    const tokens = await authService.register(
      email,
      password,
      firstName,
      lastName,
      dateOfBirth,
    );

    setAuthCookies(res, tokens);

    res
      .status(201)
      .json(createSuccessResponse(tokens, "User Registered Successfully"));
  },
);

export const login: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const tokens = await authService.login(email, password);

    setAuthCookies(res, tokens);

    res
      .status(200)
      .json(createSuccessResponse(tokens, "User logged in successfully"));
  },
);

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

export const getUserSessionStateInternal: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.params.id;

    if (!userId || typeof userId !== "string") {
      return sendErrorResponse(res, 400, "User ID is required.", {
        code: "MISSING_USER_ID",
      });
    }

    const sessionState = await authService.getUserSessionState(userId);

    return res
      .status(200)
      .json(
        createSuccessResponse(sessionState, "User session state retrieved"),
      );
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

export const forgotPassword: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
      return sendErrorResponse(res, 400, "Email is required.", {
        code: "MISSING_EMAIL",
      });
    }
    await authService.forgotPassword(email);

    return res
      .status(200)
      .json(
        createSuccessResponse(
          null,
          "If an account exists, a reset link has been sent.",
        ),
      );
  },
);

export const resetPassword: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { password } = req.body;
    const { token } = req.params;
    await authService.resetPassword(token as string, password);

    return res
      .status(200)
      .json(createSuccessResponse(null, "Password reset successfully"));
  },
);

export const verifyOtp: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const email = gatewayUser?.email;
    if (!email) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    const { otp } = req.body;
    const { tokens } = await authService.verifyOtp(email as string, otp);

    setAuthCookies(res, tokens);

    return res
      .status(200)
      .json(createSuccessResponse(tokens, "OTP verified successfully"));
  },
);

export const logout: RequestHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    clearAuthCookies(res);
    res
      .status(200)
      .json(createSuccessResponse(null, "User logged out successfully"));
  },
);

export const resendOtp: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const email = gatewayUser?.email;
    if (!email) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }
    const existingUser = await authService.getUserByEmail(email);
    if (!existingUser) {
      return sendErrorResponse(res, 404, "We could not find your account.", {
        code: "USER_NOT_FOUND",
      });
    }
    if (existingUser.emailVerified) {
      return sendErrorResponse(res, 400, "Your email is already verified.", {
        code: "EMAIL_ALREADY_VERIFIED",
      });
    }
    await authService.resendOtp(email);

    return res
      .status(200)
      .json(createSuccessResponse(null, "OTP resent successfully"));
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

export const getProviders: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;
    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const providers = await authService.getProviders(userId);

    return res
      .status(200)
      .json(createSuccessResponse(providers, "Providers retrieved"));
  },
);

export const disconnectProvider: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;
    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const providerParam = req.params.provider;
    const provider = Array.isArray(providerParam)
      ? providerParam[0]
      : providerParam;
    if (!provider || !["google"].includes(provider)) {
      return sendErrorResponse(res, 400, "Choose a valid provider.", {
        code: "INVALID_PROVIDER",
      });
    }

    await authService.disconnectProvider(userId, provider);

    return res
      .status(200)
      .json(createSuccessResponse(null, "Provider disconnected"));
  },
);

export const setPassword: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    const userId = gatewayUser?.userId;
    if (!userId) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const { password } = req.body;
    if (!password) {
      return sendErrorResponse(res, 400, "Password is required.", {
        code: "MISSING_PASSWORD",
      });
    }

    await authService.setPassword(userId, password);

    return res
      .status(200)
      .json(createSuccessResponse(null, "Password set successfully"));
  },
);
