import { Router } from "express";
import {
  initializePayment,
  handleKoraWebhook,
  getPaymentReturn,
} from "./payment.controller";
import { authenticateVerifiedGatewayRequest } from "../middleware/gatewayAuth";
import { validateRequest } from "../middleware/requestValidation";
import { initializePaymentSchema } from "./validation";

const router = Router();

// Health check
router.get("/health", (_req, res) => {
  res.json({ status: "healthy", service: "payment" });
});

// Initialize payment (protected)
router.post(
  "/initialize",
  authenticateVerifiedGatewayRequest,
  validateRequest(initializePaymentSchema),
  initializePayment,
);

// Payment return page (public, called by Kora redirect)
router.get("/return", getPaymentReturn);

// Kora webhook (public, no auth)
router.post("/webhooks/kora", handleKoraWebhook);

export default router;
