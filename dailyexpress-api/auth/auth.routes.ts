import { Router } from "express";
import * as authcontroller from "./auth.controller";
import {
  authenticateVerifiedGatewayRequest,
} from "../middleware/gatewayAuth";
import { validateRequest } from "../middleware/requestValidation";
import { completeOnboardingSchema, updateProfileSchema } from "./validation";

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
  authenticateVerifiedGatewayRequest,
  authcontroller.logout,
);

router.get(
  "/profile",
  authenticateVerifiedGatewayRequest,
  authcontroller.getProfile,
);

router.delete(
  "/delete-account",
  authenticateVerifiedGatewayRequest,
  authcontroller.deleteAccount,
);

router.put(
  "/update-profile",
  authenticateVerifiedGatewayRequest,
  validateRequest(updateProfileSchema),
  authcontroller.updateProfile,
);

router.patch(
  "/profile/complete",
  authenticateVerifiedGatewayRequest,
  validateRequest(completeOnboardingSchema),
  authcontroller.completeOnboarding,
);

export default router;