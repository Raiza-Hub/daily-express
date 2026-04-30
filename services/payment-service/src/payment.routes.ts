import { Router } from "express";
import {
  authenticateInternalServiceRequest,
  authenticateVerifiedGatewayRequest,
  validateRequest,
} from "@shared/middleware";
import * as paymentController from "./payment.controller";
import { initializePaymentSchema, upsertBookingHoldSchema } from "./validation";

const router: Router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "payment-service",
    timestamp: new Date().toISOString(),
  });
});

router.post(
  "/internal/booking-holds",
  authenticateInternalServiceRequest,
  validateRequest(upsertBookingHoldSchema),
  paymentController.upsertBookingHold,
);
router.post(
  "/internal/initialize",
  authenticateInternalServiceRequest,
  authenticateVerifiedGatewayRequest,
  validateRequest(initializePaymentSchema),
  paymentController.initializePayment,
);
router.get("/return", paymentController.handleReturn);
router.post("/webhooks/kora", paymentController.handleWebhook);

export default router;
