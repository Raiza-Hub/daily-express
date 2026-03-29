import { asyncHandler } from "@shared/middleware";
// import { asyncHandler } from "../../../shared/middleware";
import { AuthService } from "./authService";
import type { Request, Response, RequestHandler } from "express";
import type { User } from "../db/schema";
import {
  createErrorResponse,
  createServiceError,
  createSuccessResponse,
} from "@shared/utils";
// import { createSuccessResponse } from "../../../shared/utils";

const authService = new AuthService();

/**
 * I didn't envision collecting the user phone on the frontend
 * It's on the driver phone number I need
 * Have commented out the phone number field from the user
 */

export const register: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password, firstName, lastName, /*phone,*/ dateOfBirth } =
      req.body;
    const tokens = await authService.register(
      email,
      password,
      firstName,
      lastName,
      // phone,
      dateOfBirth,
    );

    //send cookies
    res.cookie("token", tokens.accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 15 * 60 * 1000, //15 minutess
    });

    //send refresh cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: false,
      // path: "/api/v1/auth/refresh-token", // come back and work on refresh token later
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
    });

    res
      .status(201)
      .json(createSuccessResponse(tokens, "User Registered Successfully"));
  },
);

export const login: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const tokens = await authService.login(email, password);

    //send cookies
    res.cookie("token", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000, //15 minutess
    });

    //send refresh cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // path: "/api/v1/auth/refresh-token", // come back and work on refresh token later
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
    });

    res
      .status(200)
      .json(createSuccessResponse(tokens, "User logged in successfully"));
  },
);

export const validateToken: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    // Read token from cookie or body (for inter-service calls)
    const token = req.cookies?.token || req.body.token;

    if (!token) {
      return res.status(401).json(createErrorResponse("No token provided"));
    }

    const payload = await authService.validateToken(token);

    return res
      .status(200)
      .json(createSuccessResponse(payload, "Token is valid"));
  },
);

export const getProfile: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json(createErrorResponse("Unauthorized"));
    }

    const user = await authService.getUserById(userId);
    if (!user) {
      return res.status(404).json(createErrorResponse("User not found"));
    }

    return res
      .status(200)
      .json(createSuccessResponse(user, "User profile retrieved"));
  },
);

export const refreshTokens: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res
        .status(401)
        .json(createErrorResponse("No refresh token provided"));
    }

    const tokens = await authService.refreshToken(refreshToken);

    res.cookie("token", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res
      .status(200)
      .json(createSuccessResponse(tokens, "Tokens refreshed successfully"));
  },
);

export const deleteAccount: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;

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
        createSuccessResponse(null, "Forgot password link sent successfully"),
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
    const email = req.user?.email;
    if (!email) {
      return res.status(401).json(createErrorResponse("Unauthorized"));
    }
    const { otp } = req.body;
    const { tokens } = await authService.verifyOtp(email as string, otp);

    res.cookie("token", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res
      .status(200)
      .json(createSuccessResponse(tokens, "OTP verified successfully"));
  },
);

export const logout: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
      }
    });
    res
      .clearCookie("token")
      .clearCookie("refreshToken")
      .clearCookie("connect.sid")
      .status(200)
      .json(createSuccessResponse(null, "User logged out successfully"));
  },
);

//resend otp function

export const resendOtp: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const email = req.user?.email;
    if (!email) {
      return res.status(401).json(createErrorResponse("Unauthorized"));
    }
    const user = await authService.getUserByEmail(email);
    if (!user) {
      return res.status(404).json(createErrorResponse("User not found"));
    }
    if (user.emailVerified) {
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
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json(createErrorResponse("Unauthorized"));
    }
    const user = await authService.updateProfile(userId, req.body);
    return res
      .status(200)
      .json(createSuccessResponse(user, "Profile updated successfully"));
  },
);

export const googleCallback: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    // User is attached to request by passport
    const user = req.user as User | undefined;

    if (!user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/sign-in?error=google_auth_failed`,
      );
    }

    // Generate tokens
    const tokens = authService.createTokens(
      user.id,
      user.email,
      user.emailVerified,
    );

    // Set HTTP-only cookies (same as regular login)
    res.cookie("token", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Get redirect URL from state parameter (echoed back by Google)
    const redirect = (req.query.state as string) || "/";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}${redirect}`);
  },
);

export const getProviders: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;
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
    const userId = req.user?.userId;
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
    const userId = req.user?.userId;
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
