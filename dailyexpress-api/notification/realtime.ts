import type {
  DriverNotification,
  DriverNotificationCreatedRealtimeEvent,
} from "@shared/types";
import {
  DRIVER_NOTIFICATION_REALTIME_VERSION,
} from "@shared/types";
import { logger } from "../utils/logger";
import { publish as ssePublish } from "./sseManager";

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

function serializeNotification(
  notification: DriverNotification,
): DriverNotification {
  return {
    ...notification,
    href: notification.href ?? null,
    readAt: toIsoString(notification.readAt),
    createdAt: toIsoString(notification.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(notification.updatedAt) ?? new Date().toISOString(),
  };
}

export async function publishNotificationCreated(
  notification: DriverNotification,
  timestamp = Date.now(),
): Promise<void> {
  const event: DriverNotificationCreatedRealtimeEvent = {
    version: DRIVER_NOTIFICATION_REALTIME_VERSION,
    type: "notification.created",
    payload: serializeNotification(notification),
    timestamp,
  };
  ssePublish(notification.driverId, "notification.created", event);
}

export function publishNotificationCreatedInBackground(
  notification: DriverNotification,
  timestamp = Date.now(),
): void {
  try {
    void publishNotificationCreated(notification, timestamp);
  } catch (error) {
    logger.warn("sse.notification_created_publish_failed", {
      driverId: notification.driverId,
      notificationId: notification.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}