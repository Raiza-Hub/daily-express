import { Router } from "express";
import { authenticateVerifiedGatewayRequest } from "../middleware/gatewayAuth";
import * as notificationController from "./notification.controller";

const router: Router = Router();

router.get(
  "/",
  authenticateVerifiedGatewayRequest,
  notificationController.getNotifications,
);

router.patch(
  "/:id/read",
  authenticateVerifiedGatewayRequest,
  notificationController.markNotificationRead,
);

export default router;
