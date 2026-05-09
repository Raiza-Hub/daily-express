import { Redis } from "@upstash/redis";
import { Realtime, type Realtime as UpstashRealtime } from "@upstash/realtime";
import type {
  DriverNotification,
  DriverNotificationCreatedRealtimeEvent,
  DriverNotificationReadRealtimeEvent,
  DriverNotificationReadAllRealtimeEvent,
} from "@shared/types";
import {
  DRIVER_NOTIFICATION_REALTIME_VERSION,
  driverNotificationCreatedRealtimeEventSchema,
  driverNotificationReadRealtimeEventSchema,
  driverNotificationReadAllRealtimeEventSchema,
} from "@shared/types";
import { getConfig } from "../config";
import { logger } from "../utils/logger";

const schema = {
  notification: {
    created: driverNotificationCreatedRealtimeEventSchema,
    read: driverNotificationReadRealtimeEventSchema,
    read_all: driverNotificationReadAllRealtimeEventSchema,
  },
} as const;

type NotificationRealtimeOptions = {
  schema: typeof schema;
  redis: Redis;
  history: {
    maxLength: number;
    expireAfterSecs: number;
  };
};

type NotificationRealtime = UpstashRealtime<NotificationRealtimeOptions>;

let realtimeInstance: NotificationRealtime | null = null;

function getRealtime(): NotificationRealtime {
  if (!realtimeInstance) {
    const config = getConfig();
    realtimeInstance = new Realtime({
      schema,
      redis: new Redis({
        url: config.NOTIFICATION_UPSTASH_REDIS_REST_URL || "",
        token: config.NOTIFICATION_UPSTASH_REDIS_REST_TOKEN || "",
      }),
      history: {
        maxLength: 500,
        expireAfterSecs: 24 * 60 * 60,
      },
    });
  }
  return realtimeInstance;
}

function getDriverChannel(driverId: string) {
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
    occurredAt: toIsoString(notification.occurredAt) ?? new Date().toISOString(),
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
    await getRealtime()
      .channel(getDriverChannel(driverId))
      .emit(event.type, event);
  } catch (error) {
    logger.warn("realtime.publish_failed", {
      driverId,
      eventType: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function publishNotificationCreated(
  notification: DriverNotification,
  timestamp = Date.now(),
): Promise<void> {
  await publishToDriverChannel(notification.driverId, {
    version: DRIVER_NOTIFICATION_REALTIME_VERSION,
    type: "notification.created",
    payload: serializeNotification(notification),
    timestamp,
  });
}

export async function publishNotificationRead(
  driverId: string,
  notificationId: string,
  timestamp = Date.now(),
): Promise<void> {
  await publishToDriverChannel(driverId, {
    version: DRIVER_NOTIFICATION_REALTIME_VERSION,
    type: "notification.read",
    payload: { id: notificationId },
    timestamp,
  });
}

export async function publishNotificationReadAll(
  driverId: string,
  timestamp = Date.now(),
): Promise<void> {
  await publishToDriverChannel(driverId, {
    version: DRIVER_NOTIFICATION_REALTIME_VERSION,
    type: "notification.read_all",
    payload: {},
    timestamp,
  });
}
