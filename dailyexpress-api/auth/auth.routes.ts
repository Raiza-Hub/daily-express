import { Router } from "express";
import * as authcontroller from "./auth.controller";
import {
  authenticateGatewayRequest,
  authenticateVerifiedGatewayRequest,
} from "../middleware/gatewayAuth";
import { validateRequest } from "../middleware/requestValidation";
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  setPasswordSchema,
} from "./validation";

const router: Router = Router();

//public routes
router.post(
  "/register",
  validateRequest(registerSchema),
  authcontroller.register,
);

router.post("/login", validateRequest(loginSchema), authcontroller.login);

router.get("/resend-otp", authenticateGatewayRequest, authcontroller.resendOtp);

// Google OAuth routes
router.get("/google", authcontroller.startGoogleOAuth);

router.get("/google/callback", authcontroller.completeGoogleOAuth);

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
