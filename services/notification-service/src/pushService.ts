import webpush from "web-push";
import { loadConfig } from "./config";
import { db } from "../db/db";
import { pushSubscription } from "../db/schema";
import { and, eq } from "drizzle-orm";
import type {
  DriverNotification,
  NotificationTone,
} from "@shared/types";

let vapidConfigured = false;

function initVapid() {
  if (vapidConfigured) return;

  const config = loadConfig();
  webpush.setVapidDetails(
    config.vapidSubject,
    config.vapidPublicKey,
    config.vapidPrivateKey,
  );
  vapidConfigured = true;
}

export interface PushSubscriptionData {
  driverId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushNotificationPayload {
  title: string;
  message: string;
  tag: string;
  href?: string | null;
  tone?: NotificationTone;
  ttl?: number;
  urgency?: "low" | "normal" | "high";
}

type PushDeliveryResult =
  | { status: "delivered" }
  | { status: "expired" }
  | { status: "transient_failure"; error: Error };

export async function subscribeDriver(
  subscription: PushSubscriptionData,
): Promise<void> {
  initVapid();

  await db
    .insert(pushSubscription)
    .values({
      driverId: subscription.driverId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [pushSubscription.driverId, pushSubscription.endpoint],
      set: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        updatedAt: new Date(),
      },
    });
}

export async function unsubscribeDriver(
  driverId: string,
  endpoint: string,
): Promise<void> {
  initVapid();

  await db
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.driverId, driverId),
        eq(pushSubscription.endpoint, endpoint),
      ),
    );
}

export async function getPushSubscriptions(driverId: string) {
  return db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.driverId, driverId));
}

interface PushError extends Error {
  statusCode?: number;
}

function buildPushBody(payload: PushNotificationPayload) {
  return JSON.stringify({
    title: payload.title,
    message: payload.message,
    tag: payload.tag || "daily-express-notification",
    href: payload.href || null,
  });
}

function isRetryablePushError(statusCode?: number) {
  if (!statusCode) {
    return true;
  }

  return (
    statusCode === 408 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500
  );
}

function getToneUrgency(tone?: NotificationTone): "low" | "normal" | "high" {
  if (tone === "critical" || tone === "attention") {
    return "high";
  }
  if (tone === "positive" || tone === "info") {
    return "normal";
  }
  return "normal";
}

function getToneTTL(tone?: NotificationTone): number {
  if (tone === "critical") {
    return 0;
  }
  if (tone === "attention") {
    return 3600;
  }
  return 86400;
}

async function sendNotificationWithRetry(
  subscription: Omit<PushSubscriptionData, "driverId">,
  payload: PushNotificationPayload,
): Promise<PushDeliveryResult> {
  const body = buildPushBody(payload);
  const options = {
    TTL: payload.ttl ?? getToneTTL(payload.tone),
    urgency: payload.urgency ?? getToneUrgency(payload.tone),
  };

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      body,
      options,
    );
    return { status: "delivered" };
  } catch (error) {
    const err = error as PushError;

    if (err.statusCode === 410 || err.statusCode === 404) {
      return { status: "expired" };
    }

    if (isRetryablePushError(err.statusCode)) {
      return {
        status: "transient_failure",
        error: err instanceof Error ? err : new Error(String(error)),
      };
    }

    return {
      status: "transient_failure",
      error: err instanceof Error ? err : new Error(String(error)),
    };
  }
}

export async function sendPushToSubscription(
  driverId: string,
  subscription: PushSubscriptionData,
  payload: PushNotificationPayload,
): Promise<PushDeliveryResult> {
  initVapid();

  const result = await sendNotificationWithRetry(
    {
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
    payload,
  );

  if (result.status === "expired") {
    await unsubscribeDriver(driverId, subscription.endpoint);
  }

  return result;
}

export async function sendPushNotification(
  driverId: string,
  payload: PushNotificationPayload,
): Promise<{ sent: number; failed: number }> {
  initVapid();

  const subscriptions = await getPushSubscriptions(driverId);

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const results = await Promise.all(
    subscriptions.map((subscription) =>
      sendPushToSubscription(
        driverId,
        {
          driverId,
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
        payload,
      ),
    ),
  );

  let sent = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === "delivered") {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

export async function sendPushForNotification(
  notification: DriverNotification,
): Promise<{ sent: number; failed: number }> {
  const payload: PushNotificationPayload = {
    title: notification.title,
    message: notification.message,
    tag: notification.tag,
    href: notification.href || undefined,
    tone: notification.tone,
  };

  return sendPushNotification(notification.driverId, payload);
}

export function getVapidPublicKey(): string {
  return loadConfig().vapidPublicKey;
}
