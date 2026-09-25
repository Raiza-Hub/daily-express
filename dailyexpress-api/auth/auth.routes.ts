import { Router } from "express";
import * as authcontroller from "./auth.controller";
import {
  authenticateVerifiedGatewayRequest,
} from "../middleware/gatewayAuth";
import { validateRequest } from "../middleware/requestValidation";
import { completeOnboardingSchema, updateProfileSchema } from "./validation";
import { authenticateSession } from "../middleware/auth";

const router: Router = Router();

router.get(
  "/google",
  authcontroller.startGoogleOAuth
);

router.get(
  "/google/callback",
  authcontroller.completeGoogleOAuth
);

router.get(
  "/logout",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  authcontroller.logout,
);

router.get(
  "/profile",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  authcontroller.getProfile,
);

router.delete(
  "/delete-account",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  authcontroller.deleteAccount,
);

router.put(
  "/update-profile",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  validateRequest(updateProfileSchema),
  authcontroller.updateProfile,
);

router.patch(
  "/profile/complete",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  validateRequest(completeOnboardingSchema),
  authcontroller.completeOnboarding,
);

export default router;