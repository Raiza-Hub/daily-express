import { Router, type Request, type Response } from "express";
import { asyncHandler } from "@shared/middleware";
import { getAuthenticatedUser } from "../middleware/auth";
import { authenticateVerifiedGatewayRequest } from "../middleware/gatewayAuth";
import { sendErrorResponse } from "../middleware/apiResponses";
import { NotificationRepository } from "./notification.repository";
import { subscribe, startKeepalive, sendInitialConnected } from "./sseManager";

const router = Router();
const repo = new NotificationRepository();

router.get(
  "/stream",
  authenticateVerifiedGatewayRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    if (!gatewayUser) {
      sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    let driverId: string;
    try {
      const driverRecord = await repo.findDriverByUserId(gatewayUser.userId);
      if (!driverRecord) {
        sendErrorResponse(res, 404, "Driver not found.", {
          code: "DRIVER_NOT_FOUND",
        });
        return;
      }
      driverId = driverRecord.id;
    } catch {
      sendErrorResponse(res, 500, "Failed to establish notification stream.", {
        code: "STREAM_SETUP_FAILED",
      });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    sendInitialConnected(res);
    const unsubscribe = subscribe(driverId, res);
    const keepalive = startKeepalive(res);

    req.on("close", () => {
      unsubscribe();
      clearInterval(keepalive);
    });
  }),
);

export default router;
