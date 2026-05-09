import { Router } from "express";
import * as payoutController from "./payout.controller";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "payout",
    timestamp: new Date().toISOString(),
  });
});

router.get("/balance", payoutController.getBalance);
router.get("/history", payoutController.getHistory);
router.get("/summary", payoutController.getSummary);
router.post("/webhooks/kora", payoutController.handleWebhook);

export default router;
