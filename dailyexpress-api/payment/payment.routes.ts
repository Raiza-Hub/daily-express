import { Router } from "express";
import {
  initializePayment,
  handleKoraWebhook,
  getPaymentReturn,
} from "./payment.controller";
import { authenticateVerifiedGatewayRequest } from "../middleware/gatewayAuth";
import { createTokenBucketLimiter } from "../middleware/tokenBucket";
import { getConfig } from "../config/index";
import { validateRequest } from "../middleware/requestValidation";
import { initializePaymentSchema } from "./validation";

const config = getConfig();

const paymentLimiter = createTokenBucketLimiter({
  capacity: config.TOKEN_BUCKET_PAYMENT_CAPACITY,
  refillRate: config.TOKEN_BUCKET_PAYMENT_REFILL_RATE,
  refillIntervalSec: config.TOKEN_BUCKET_PAYMENT_REFILL_INTERVAL_SEC,
  prefix: "payment",
  message: "Too many payment attempts. Please try again later.",
});

const router = Router();

// Health check
router.get("/health", (_req, res) => {
  res.json({ status: "healthy", service: "payment" });
});

// Initialize payment (protected)
router.post(
  "/initialize",
  authenticateVerifiedGatewayRequest,
  paymentLimiter,
  validateRequest(initializePaymentSchema),
  initializePayment,
);

// Payment return page (public, called by Kora redirect)
const paymentReturnLimiter = createTokenBucketLimiter({
  capacity: 10,
  refillRate: 1,
  refillIntervalSec: 60,
  prefix: "payment_return",
  message: "Too many requests. Please try again later.",
});

router.get("/return", paymentReturnLimiter, getPaymentReturn);

// Kora webhook (public, no auth)
router.post("/webhooks/kora", handleKoraWebhook);

export default router;
