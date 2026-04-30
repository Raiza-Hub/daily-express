export interface NotificationServiceConfig {
  port: number;
  nodeEnv: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  upstashRedisRestUrl: string;
  upstashRedisRestToken: string;
}

let config: NotificationServiceConfig | null = null;

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(): NotificationServiceConfig {
  if (config) {
    return config;
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  const upstashRedisRestUrl = process.env.NOTIFICATION_UPSTASH_REDIS_REST_URL;
  const upstashRedisRestToken = process.env.NOTIFICATION_UPSTASH_REDIS_REST_TOKEN;

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    throw new Error(
      "VAPID keys are required for push notifications. Please set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT environment variables.",
    );
  }

  if (!upstashRedisRestUrl || !upstashRedisRestToken) {
    throw new Error(
      "Upstash Realtime is required for notifications. Please set NOTIFICATION_UPSTASH_REDIS_REST_URL and NOTIFICATION_UPSTASH_REDIS_REST_TOKEN.",
    );
  }

  config = {
    port: parseInteger(process.env.PORT, 3006),
    nodeEnv: process.env.NODE_ENV || "development",
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
    upstashRedisRestUrl,
    upstashRedisRestToken,
  };

  return config;
}
