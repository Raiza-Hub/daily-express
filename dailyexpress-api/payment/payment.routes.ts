import { Router } from "express";
import {
  initializePayment,
  handleKoraWebhook,
  getPaymentReturn,
} from "./payment.controller";
import { authenticateVerifiedGatewayRequest } from "../middleware/gatewayAuth";
import { validateRequest } from "../middleware/requestValidation";
import { initializePaymentSchema } from "./validation";
import { authenticateSession } from "../middleware/auth";

const router = Router();

// Payment return page (public, called by Kora redirect)
router.get("/return", getPaymentReturn);

// Kora webhook (public, no auth)
router.post("/webhooks/kora", handleKoraWebhook);

// Initialize payment (protected)
router.post(
  "/initialize",
  authenticateSession,
  authenticateVerifiedGatewayRequest,
  validateRequest(initializePaymentSchema),
  initializePayment,
);

export default router;
