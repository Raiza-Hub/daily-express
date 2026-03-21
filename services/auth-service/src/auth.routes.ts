import { Router } from "express";
import * as authcontroller from "./auth.controller";
import { authenticateToken, validateRequest } from "@shared/middleware";
// import { validateRequest } from '../../../shared/middleware'
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  updateProfileSchema,
} from "./validation";

const router: Router = Router();

//public routes
router.post(
  "/register",
  validateRequest(registerSchema),
  authcontroller.register,
);
router.post("/login", validateRequest(loginSchema), authcontroller.login);
router.post("/resend-otp", authcontroller.resendOtp);

// remember to add refresh token
router.post(
  "/refresh",
  validateRequest(refreshTokenSchema),
  authcontroller.refreshTokens,
);

//token validation endpoint
router.post("/validate", authcontroller.validateToken);

//protected routes
router.get("/logout", authenticateToken, authcontroller.logout);
router.post("/forget-password", authcontroller.forgotPassword);
router.post("/verify-otp", authcontroller.verifyOtp);
router.post("/reset-password/:token", authcontroller.resetPassword);
router.get("/profile", authenticateToken, authcontroller.getProfile);
router.delete("/profile", authenticateToken, authcontroller.deleteAccount);
router.put(
  "/profile",
  authenticateToken,
  validateRequest(updateProfileSchema),
  authcontroller.updateProfile,
);

export default router;
