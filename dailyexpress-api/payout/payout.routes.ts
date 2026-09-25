import { Router } from "express";
import * as payoutController from "./payout.controller";
import { authenticateSession } from "../middleware/auth";

const router = Router();

router.post("/webhooks/kora", payoutController.handleWebhook);

router.get(
  "/history",
  authenticateSession,
  payoutController.getHistory,
);

export default router;
