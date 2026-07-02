import type {
  DriverNotification,
  DriverNotificationCreatedRealtimeEvent,
  DriverNotificationReadRealtimeEvent,
  DriverNotificationReadAllRealtimeEvent,
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
    occurredAt: toIsoString(notification.occurredAt) ?? new Date().toISOString(),
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

export async function publishNotificationRead(
  driverId: string,
  notificationId: string,
  timestamp = Date.now(),
): Promise<void> {
  const event: DriverNotificationReadRealtimeEvent = {
    version: DRIVER_NOTIFICATION_REALTIME_VERSION,
    type: "notification.read",
    payload: { id: notificationId },
    timestamp,
  };
  ssePublish(driverId, "notification.read", event);
}

export function publishNotificationReadInBackground(
  driverId: string,
  notificationId: string,
  timestamp = Date.now(),
): void {
  try {
    void publishNotificationRead(driverId, notificationId, timestamp);
  } catch (error) {
    logger.warn("sse.notification_read_publish_failed", {
      driverId,
      notificationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function publishNotificationReadAll(
  driverId: string,
  timestamp = Date.now(),
): Promise<void> {
  const event: DriverNotificationReadAllRealtimeEvent = {
    version: DRIVER_NOTIFICATION_REALTIME_VERSION,
    type: "notification.read_all",
    payload: {},
    timestamp,
  };
  ssePublish(driverId, "notification.read_all", event);
}

export function publishNotificationReadAllInBackground(
  driverId: string,
  timestamp = Date.now(),
): void {
  try {
    void publishNotificationReadAll(driverId, timestamp);
  } catch (error) {
    logger.warn("sse.notification_read_all_publish_failed", {
      driverId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
