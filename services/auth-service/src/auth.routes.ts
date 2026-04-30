import { Router } from "express";
import passport from "passport";
import * as authcontroller from "./auth.controller";
import {
  authenticateInternalServiceRequest,
  authenticateGatewayRequest,
  authenticateVerifiedGatewayRequest,
  validateRequest,
} from "@shared/middleware";
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  setPasswordSchema,
} from "./validation";
import { GOOGLE_AUTH_FAILURE_REDIRECT_URL } from "./authUrls";

const router: Router = Router();

//public routes
router.post(
  "/register",
  validateRequest(registerSchema),
  authcontroller.register,
);

router.post(
  "/login",
  validateRequest(loginSchema),
  authcontroller.login
);

router.get(
  "/resend-otp",
  authenticateGatewayRequest,
  authcontroller.resendOtp
);

// Google OAuth routes
router.get("/google", (req, res, next) => {
  const state = req.query.state as string;
  passport.authenticate("google", {
    state,
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/user.birthday.read",
    ],
  })(req, res, next);
});

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: GOOGLE_AUTH_FAILURE_REDIRECT_URL,
  }),
  authcontroller.googleCallback,
);

router.get(
  "/logout",
  authenticateVerifiedGatewayRequest,
  authcontroller.logout,
);

router.post(
  "/forget-password",
  validateRequest(forgotPasswordSchema),
  authcontroller.forgotPassword,
);

router.post(
  "/verify-otp",
  authenticateGatewayRequest,
  authcontroller.verifyOtp,
);

router.post(
  "/reset-password/:token",
  validateRequest(resetPasswordSchema),
  authcontroller.resetPassword,
);
router.get(
  "/internal/users/:id/session",
  authenticateInternalServiceRequest,
  authcontroller.getUserSessionStateInternal,
);

router.get(
  "/profile",
  authenticateVerifiedGatewayRequest,
  authcontroller.getProfile,
);

router.delete(
  "/profile",
  authenticateVerifiedGatewayRequest,
  authcontroller.deleteAccount,
);

router.put(
  "/profile",
  authenticateVerifiedGatewayRequest,
  validateRequest(updateProfileSchema),
  authcontroller.updateProfile,
);

// Connected providers
router.get(
  "/providers",
  authenticateVerifiedGatewayRequest,
  authcontroller.getProviders,
);

router.delete(
  "/providers/:provider",
  authenticateVerifiedGatewayRequest,
  authcontroller.disconnectProvider,
);

// Set password (authenticated user sets password without old password)
router.post(
  "/password",
  authenticateVerifiedGatewayRequest,
  validateRequest(setPasswordSchema),
  authcontroller.setPassword,
);

export default router;
