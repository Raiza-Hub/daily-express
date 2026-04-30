import { Redis } from "@upstash/redis";
import { Realtime } from "@upstash/realtime";
import {
  driverNotificationCreatedRealtimeEventSchema,
  driverNotificationReadRealtimeEventSchema,
  driverNotificationReadAllRealtimeEventSchema,
} from "@shared/types";
import { env } from "~/env";
export { getDriverNotificationChannel } from "~/lib/realtime-shared";

const REALTIME_HISTORY_MAX_LENGTH = 500;
const REALTIME_HISTORY_TTL_SECS = 24 * 60 * 60;

export const isDriverNotificationRealtimeConfigured = Boolean(
  env.NOTIFICATION_UPSTASH_REDIS_REST_URL &&
    env.NOTIFICATION_UPSTASH_REDIS_REST_TOKEN,
);

export const driverNotificationRealtime = isDriverNotificationRealtimeConfigured
  ? new Realtime({
      schema: {
        notification: {
          created: driverNotificationCreatedRealtimeEventSchema,
          read: driverNotificationReadRealtimeEventSchema,
          read_all: driverNotificationReadAllRealtimeEventSchema,
        },
      },
      redis: new Redis({
        url: env.NOTIFICATION_UPSTASH_REDIS_REST_URL!,
        token: env.NOTIFICATION_UPSTASH_REDIS_REST_TOKEN!,
      }),
      history: {
        maxLength: REALTIME_HISTORY_MAX_LENGTH,
        expireAfterSecs: REALTIME_HISTORY_TTL_SECS,
      },
      maxDurationSecs: 300,
    })
  : null;
