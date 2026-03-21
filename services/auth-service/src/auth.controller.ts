import { asyncHandler } from "@shared/middleware";
// import { asyncHandler } from "../../../shared/middleware";
import { AuthService } from "./authService";
import type { Request, Response, RequestHandler } from "express";
import {
  createErrorResponse,
  createServiceError,
  createSuccessResponse,
} from "@shared/utils";
// import { createSuccessResponse } from "../../../shared/utils";

const authService = new AuthService();

export const register: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, password, firstName, lastName, phone, dateOfBirth } =
      req.body;
    const tokens = await authService.register(
      email,
      password,
      firstName,
      lastName,
      phone,
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
      .status(200)
      .json(createSuccessResponse(tokens, "User logged in successfully"));
  },
);

export const validateToken: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

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
    const { refreshToken } = req.body;
    const tokens = await authService.refreshToken(refreshToken);

    res
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
    const email = req.body.email;
    const { otp } = req.body;
    const tokens = await authService.verifyOtp(email as string, otp);

    res
      .status(200)
      .json(createSuccessResponse(tokens, "OTP verified successfully"));
  },
);

//resend otp function

export const logout: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    res
      .clearCookie("token")
      .clearCookie("refreshToken")
      .status(200)
      .json(createSuccessResponse(null, "User logged out successfully"));
  },
);

export const resendOtp: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
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
