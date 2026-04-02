import { Router } from "express";
import {
  authenticateVerifiedGatewayRequest,
  validateRequest,
} from "@shared/middleware";
import * as paymentController from "./payment.controller";
import { initializePaymentSchema, paystackWebhookSchema } from "./validation";

const router: Router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "payment-service",
    timestamp: new Date().toISOString(),
  });
});

router.post(
  "/initialize",
  authenticateVerifiedGatewayRequest,
  validateRequest(initializePaymentSchema),
  paymentController.initializePayment,
);
router.get(
  "/reference/:reference",
  authenticateVerifiedGatewayRequest,
  paymentController.getPaymentByReference,
);
router.post(
  "/reference/:reference/refresh",
  authenticateVerifiedGatewayRequest,
  paymentController.refreshPaymentStatus,
);
router.post(
  "/webhooks/paystack",
  validateRequest(paystackWebhookSchema),
  paymentController.handleWebhook,
);

export default router;
