import { asyncHandler } from "@shared/middleware";
import { AuthService } from "./authService";
import type { CookieOptions, Request, Response, RequestHandler } from "express";
import type { User } from "../db/schema";
import type { JWTPayload } from "@shared/types";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";
import { logger } from "@shared/logger";
import {
  GOOGLE_AUTH_FAILURE_REDIRECT_URL,
  resolveFrontendRedirect,
} from "./authUrls";

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
  res.clearCookie("connect.sid", clearCookieOptions);
}

function getGatewayUser(req: Request): JWTPayload | null {
  const user = req.user;

  if (!user || !("userId" in user) || !("email" in user)) {
    return null;
  }

  return user as JWTPayload;
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
    const gatewayUser = getGatewayUser(req);
    const userId = gatewayUser?.userId;
    if (!userId) {
      return res.status(401).json(createErrorResponse("Unauthorized"));
    }

    const profile = await authService.getUserById(userId);
    if (!profile) {
      return res.status(404).json(createErrorResponse("User not found"));
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
      return res.status(400).json(createErrorResponse("User ID is required"));
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
    const gatewayUser = getGatewayUser(req);
    const userId = gatewayUser?.userId;

    if (!userId) {
      return res.status(401).json(createErrorResponse("Unauthorized"));
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
      return res.status(400).json(createErrorResponse("Email is required"));
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
    const gatewayUser = getGatewayUser(req);
    const email = gatewayUser?.email;
    if (!email) {
      return res.status(401).json(createErrorResponse("Unauthorized"));
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
  async (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        logger.error("auth.session_destroy_failed", {
          error: err,
        });
      }
    });
    clearAuthCookies(res);
    res
      .status(200)
      .json(createSuccessResponse(null, "User logged out successfully"));
  },
);

export const resendOtp: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getGatewayUser(req);
    const email = gatewayUser?.email;
    if (!email) {
      return res.status(401).json(createErrorResponse("Unauthorized"));
    }
    const existingUser = await authService.getUserByEmail(email);
    if (!existingUser) {
      return res.status(404).json(createErrorResponse("User not found"));
    }
    if (existingUser.emailVerified) {
      return res.status(400).json(createErrorResponse("User already verified"));
    }
    await authService.resendOtp(email);

    return res
      .status(200)
      .json(createSuccessResponse(null, "OTP resent successfully"));
  },
);

export const updateProfile: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getGatewayUser(req);
    const userId = gatewayUser?.userId;
    if (!userId) {
      return res.status(401).json(createErrorResponse("Unauthorized"));
    }
    const updatedUser = await authService.updateProfile(userId, req.body);

    return res
      .status(200)
      .json(createSuccessResponse(updatedUser, "Profile updated successfully"));
  },
);

export const googleCallback: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    // User is attached to request by passport
    const user = req.user as User | undefined;

    if (!user) {
      return res.redirect(GOOGLE_AUTH_FAILURE_REDIRECT_URL);
    }

    // Generate tokens
    const tokens = authService.createTokens(
      user.id,
      user.email,
      user.emailVerified,
    );

    setAuthCookies(res, tokens);

    // Get redirect URL from state parameter (echoed back by Google)
    const redirect = req.query.state as string | undefined;
    res.redirect(resolveFrontendRedirect(redirect));
  },
);

export const getProviders: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getGatewayUser(req);
    const userId = gatewayUser?.userId;
    if (!userId) {
      return res.status(401).json(createErrorResponse("Unauthorized"));
    }

    const providers = await authService.getProviders(userId);

    return res
      .status(200)
      .json(createSuccessResponse(providers, "Providers retrieved"));
  },
);

export const disconnectProvider: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getGatewayUser(req);
    const userId = gatewayUser?.userId;
    if (!userId) {
      return res.status(401).json(createErrorResponse("Unauthorized"));
    }

    const providerParam = req.params.provider;
    const provider = Array.isArray(providerParam)
      ? providerParam[0]
      : providerParam;
    if (!provider || !["google"].includes(provider)) {
      return res.status(400).json(createErrorResponse("Invalid provider"));
    }

    await authService.disconnectProvider(userId, provider);

    return res
      .status(200)
      .json(createSuccessResponse(null, "Provider disconnected"));
  },
);

export const setPassword: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getGatewayUser(req);
    const userId = gatewayUser?.userId;
    if (!userId) {
      return res.status(401).json(createErrorResponse("Unauthorized"));
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json(createErrorResponse("Password is required"));
    }

    await authService.setPassword(userId, password);

    return res
      .status(200)
      .json(createSuccessResponse(null, "Password set successfully"));
  },
);
