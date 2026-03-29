import { Router } from "express";
import passport from "passport";
import * as authcontroller from "./auth.controller";
import {
  authenticateTokenFromCookieUnverified,
  refreshAndValidateCookie,
  validateRequest,
} from "@shared/middleware";
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./validation";

const router: Router = Router();

//public routes
router.post(
  "/register",
  validateRequest(registerSchema),
  authcontroller.register
);

router.post(
  "/login",
  validateRequest(loginSchema),
  authcontroller.login
);

router.get(
  "/resend-otp",
  authenticateTokenFromCookieUnverified,
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
  passport.authenticate("google", { failureRedirect: "/login" }),
  authcontroller.googleCallback
);

router.post(
  "/validate",
  authcontroller.validateToken
);

router.get(
  "/logout",
  refreshAndValidateCookie,
  authcontroller.logout
);

router.post(
  "/forget-password",
  validateRequest(forgotPasswordSchema),
  authcontroller.forgotPassword
);

router.post(
  "/verify-otp",
  authenticateTokenFromCookieUnverified,
  authcontroller.verifyOtp
);

router.post(
  "/reset-password/:token",
  validateRequest(resetPasswordSchema),
  authcontroller.resetPassword
);
router.get(
  "/profile",
  refreshAndValidateCookie,
  authcontroller.getProfile
);

router.delete(
  "/profile",
  refreshAndValidateCookie,
  authcontroller.deleteAccount
);

router.put(
  "/profile",
  refreshAndValidateCookie,
  validateRequest(updateProfileSchema),
  authcontroller.updateProfile
);

// Connected providers
router.get(
  "/providers",
  refreshAndValidateCookie,
  authcontroller.getProviders
);

router.delete(
  "/providers/:provider",
  refreshAndValidateCookie,
  authcontroller.disconnectProvider
);

// Set password (authenticated user sets password without old password)
router.post(
  "/password",
  refreshAndValidateCookie,
  authcontroller.setPassword
);

export default router;
