import { Router } from "express";
import { authenticateVerifiedGatewayRequest } from "@shared/middleware";
import * as notificationController from "./notification.controller";
import * as pushController from "./push.controller";

const router: Router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "notification-service",
    timestamp: new Date().toISOString(),
  });
});

router.get(
  "/notifications",
  authenticateVerifiedGatewayRequest,
  notificationController.getNotifications,
);
router.patch(
  "/notifications/:id/read",
  authenticateVerifiedGatewayRequest,
  notificationController.markNotificationRead,
);
router.post(
  "/notifications/read-all",
  authenticateVerifiedGatewayRequest,
  notificationController.markAllNotificationsRead,
);

router.get(
  "/notifications/push/vapid-public-key",
  authenticateVerifiedGatewayRequest,
  pushController.getVapidPublicKeyHandler,
);
router.post(
  "/notifications/push/subscribe",
  authenticateVerifiedGatewayRequest,
  pushController.subscribeHandler,
);
router.delete(
  "/notifications/push/subscribe",
  authenticateVerifiedGatewayRequest,
  pushController.unsubscribeHandler,
);

export default router;
