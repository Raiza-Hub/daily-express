import type { Request, Response } from "express";
import { logger } from "@shared/logger";
import {
  subscribeDriver,
  unsubscribeDriver,
  getVapidPublicKey,
} from "./pushService";
import { NotificationService } from "./notificationService";
import { createErrorResponse } from "@shared/utils";
import { sentryServer } from "@shared/sentry";

const pushLogger = logger.child({ component: "push-controller" });
const notificationService = new NotificationService();

function getErrorDetails(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  ) {
    return {
      statusCode: (error as { statusCode: number }).statusCode,
      message:
        error instanceof Error ? error.message : "Push subscription request failed",
    };
  }

  return {
    statusCode: 500,
    message: "Failed to process push notification request",
  };
}

export function getVapidPublicKeyHandler(_req: Request, res: Response): void {
  const publicKey = getVapidPublicKey();
  res.json({
    success: true,
    data: publicKey,
  });
}

interface SubscribeBody {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function subscribeHandler(
  req: Request<{}, {}, SubscribeBody>,
  res: Response,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
      return;
    }

    const { endpoint, p256dh, auth } = req.body;

    if (!endpoint || !p256dh || !auth) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: endpoint, p256dh, auth",
      });
      return;
    }

    const driverId = await notificationService.getDriverIdForUser(user);

    await subscribeDriver({
      driverId,
      endpoint,
      p256dh,
      auth,
    });

    res.json({
      success: true,
      message: "Push subscription saved",
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    pushLogger.error("push.subscribe_failed", {
      error: err.message,
      userId: req.user?.userId,
    });
    sentryServer.captureException(error, req.user?.userId || "unknown", {
      action: "push_subscribe",
    });
    const details = getErrorDetails(error);
    res.status(details.statusCode).json(createErrorResponse(details.message));
  }
}

interface UnsubscribeBody {
  endpoint: string;
}

export async function unsubscribeHandler(
  req: Request<{}, {}, UnsubscribeBody>,
  res: Response,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
      return;
    }

    const { endpoint } = req.body;

    if (!endpoint) {
      res.status(400).json({
        success: false,
        error: "Missing required field: endpoint",
      });
      return;
    }

    const driverId = await notificationService.getDriverIdForUser(user);

    await unsubscribeDriver(driverId, endpoint);

    res.json({
      success: true,
      message: "Push subscription removed",
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    pushLogger.error("push.unsubscribe_failed", {
      error: err.message,
      userId: req.user?.userId,
    });
    sentryServer.captureException(error, req.user?.userId || "unknown", {
      action: "push_unsubscribe",
    });
    const details = getErrorDetails(error);
    res.status(details.statusCode).json(createErrorResponse(details.message));
  }
}
