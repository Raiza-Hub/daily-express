import { Router } from "express";
import * as authcontroller from "./auth.controller";
import {
  authenticateGatewayRequest,
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
  authenticateGatewayRequest,
  authcontroller.logout,
);

router.get(
  "/profile",
  authenticateSession,
  authenticateGatewayRequest,
  authcontroller.getProfile,
);

router.delete(
  "/delete-account",
  authenticateSession,
  authenticateGatewayRequest,
  authcontroller.deleteAccount,
);

router.put(
  "/update-profile",
  authenticateSession,
  authenticateGatewayRequest,
  validateRequest(updateProfileSchema),
  authcontroller.updateProfile,
);

router.patch(
  "/profile/complete",
  authenticateSession,
  authenticateGatewayRequest,
  validateRequest(completeOnboardingSchema),
  authcontroller.completeOnboarding,
);

export default router;