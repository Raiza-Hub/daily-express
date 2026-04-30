import { Redis } from "@upstash/redis";
import { Realtime } from "@upstash/realtime";
import type {
  DriverNotification,
  DriverNotificationCreatedRealtimeEvent,
  DriverNotificationReadAllRealtimeEvent,
  DriverNotificationReadRealtimeEvent,
} from "@shared/types";
import {
  DRIVER_NOTIFICATION_REALTIME_VERSION,
  driverNotificationCreatedRealtimeEventSchema,
  driverNotificationReadRealtimeEventSchema,
  driverNotificationReadAllRealtimeEventSchema,
} from "@shared/types";
import { logger } from "@shared/logger";
import { loadConfig } from "../config";

const realtimeLogger = logger.child({ component: "notification-realtime" });
const REALTIME_HISTORY_MAX_LENGTH = 500;
const REALTIME_HISTORY_TTL_SECS = 24 * 60 * 60;

const realtimeConfig = loadConfig();

const realtime = new Realtime({
  schema: {
    notification: {
      created: driverNotificationCreatedRealtimeEventSchema,
      read: driverNotificationReadRealtimeEventSchema,
      read_all: driverNotificationReadAllRealtimeEventSchema,
    },
  },
  redis: new Redis({
    url: realtimeConfig.upstashRedisRestUrl,
    token: realtimeConfig.upstashRedisRestToken,
  }),
  history: {
    maxLength: REALTIME_HISTORY_MAX_LENGTH,
    expireAfterSecs: REALTIME_HISTORY_TTL_SECS,
  },
});

function getDriverNotificationChannel(driverId: string) {
  return `driver:${driverId}`;
}

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
    occurredAt:
      toIsoString(notification.occurredAt) ?? new Date().toISOString(),
    createdAt: toIsoString(notification.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(notification.updatedAt) ?? new Date().toISOString(),
  };
}

async function publishToDriverChannel(
  driverId: string,
  event:
    | DriverNotificationCreatedRealtimeEvent
    | DriverNotificationReadRealtimeEvent
    | DriverNotificationReadAllRealtimeEvent,
) {
  try {
    await realtime
      .channel(getDriverNotificationChannel(driverId))
      .emit(event.type, event);
  } catch (error) {
    realtimeLogger.warn("realtime.publish_failed", {
      driverId,
      eventType: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function publishCreatedNotificationRealtimeEvent(
  notification: DriverNotification,
  timestamp = Date.now(),
) {
  await publishToDriverChannel(notification.driverId, {
    version: DRIVER_NOTIFICATION_REALTIME_VERSION,
    type: "notification.created",
    payload: serializeNotification(notification),
    timestamp,
  });
}

export async function publishReadNotificationRealtimeEvent(
  driverId: string,
  id: string,
  timestamp = Date.now(),
) {
  await publishToDriverChannel(driverId, {
    version: DRIVER_NOTIFICATION_REALTIME_VERSION,
    type: "notification.read",
    payload: { id },
    timestamp,
  });
}

export async function publishReadAllNotificationsRealtimeEvent(
  driverId: string,
  timestamp = Date.now(),
) {
  await publishToDriverChannel(driverId, {
    version: DRIVER_NOTIFICATION_REALTIME_VERSION,
    type: "notification.read_all",
    payload: {},
    timestamp,
  });
}
