import { Router } from "express";
import {
  authenticateVerifiedGatewayRequest,
  validateRequest,
} from "@shared/middleware";
import * as payoutController from "./payout.controller";
import { koraWebhookSchema, resolveBankAccountSchema } from "./validation";

const router: Router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "payout-service",
    timestamp: new Date().toISOString(),
  });
});

router.get(
  "/balance",
  authenticateVerifiedGatewayRequest,
  payoutController.getBalance,
);
router.get(
  "/history",
  authenticateVerifiedGatewayRequest,
  payoutController.getHistory,
);
router.get(
  "/summary",
  authenticateVerifiedGatewayRequest,
  payoutController.getSummary,
);
router.post(
  "/bank-accounts/resolve",
  authenticateVerifiedGatewayRequest,
  validateRequest(resolveBankAccountSchema),
  payoutController.resolveBankAccount,
);
router.post(
  "/webhooks/kora",
  validateRequest(koraWebhookSchema),
  payoutController.handleWebhook,
);

export default router;
