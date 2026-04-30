import { createHash } from "node:crypto";
import { PgBoss } from "pg-boss";
import { logger } from "@shared/logger";
import type {
  DriverNotification,
  NotificationTone,
} from "@shared/types";

export const QUEUES = {
  PROCESS_NOTIFICATION_EVENT: "notification.process.event",
  PROCESS_NOTIFICATION_EVENT_DLQ: "notification.process.event.dlq",
  DISPATCH_NOTIFICATION: "notification.dispatch",
  DISPATCH_NOTIFICATION_DLQ: "notification.dispatch.dlq",
  DELIVER_PUSH: "notification.deliver.push",
  DELIVER_PUSH_DLQ: "notification.deliver.push.dlq",
  DELIVER_REALTIME: "notification.deliver.realtime",
  DELIVER_REALTIME_DLQ: "notification.deliver.realtime.dlq",
} as const;

export interface NotificationEventJobData {
  topic: string;
  rawMessage: string;
  eventId: string;
}

export interface PushDeliveryJobData {
  notificationId: string;
  driverId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: {
    title: string;
    message: string;
    tag: string;
    href?: string | null;
    tone?: NotificationTone;
  };
}

export interface DispatchNotificationJobData {
  notificationId: string;
}

export type RealtimeDeliveryJobData =
  | {
      eventType: "notification.created";
      driverId: string;
      notification: DriverNotification;
      timestamp: number;
    }
  | {
      eventType: "notification.read";
      driverId: string;
      notificationId: string;
      timestamp: number;
    }
  | {
      eventType: "notification.read_all";
      driverId: string;
      timestamp: number;
    };

let boss: PgBoss | null = null;

function buildSingletonKey(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

async function createQueues(instance: PgBoss) {
  // DLQs must exist before primary queues can reference them
  await instance.createQueue(QUEUES.PROCESS_NOTIFICATION_EVENT_DLQ, {
    retryLimit: 0,
  });
  await instance.createQueue(QUEUES.DISPATCH_NOTIFICATION_DLQ, {
    retryLimit: 0,
  });
  await instance.createQueue(QUEUES.DELIVER_PUSH_DLQ, {
    retryLimit: 0,
  });
  await instance.createQueue(QUEUES.DELIVER_REALTIME_DLQ, {
    retryLimit: 0,
  });

  await instance.createQueue(QUEUES.PROCESS_NOTIFICATION_EVENT, {
    retryLimit: 4,
    retryDelay: 5,
    retryBackoff: true,
    retryDelayMax: 60,
    deleteAfterSeconds: 86_400,
    deadLetter: QUEUES.PROCESS_NOTIFICATION_EVENT_DLQ,
  });

  await instance.createQueue(QUEUES.DISPATCH_NOTIFICATION, {
    policy: "stately",
    retryLimit: 4,
    retryDelay: 5,
    retryBackoff: true,
    retryDelayMax: 60,
    heartbeatSeconds: 30,
    deleteAfterSeconds: 86_400,
    deadLetter: QUEUES.DISPATCH_NOTIFICATION_DLQ,
  });

  await instance.createQueue(QUEUES.DELIVER_PUSH, {
    policy: "stately",
    retryLimit: 4,
    retryDelay: 15,
    retryBackoff: true,
    retryDelayMax: 300,
    heartbeatSeconds: 30,
    deleteAfterSeconds: 86_400,
    deadLetter: QUEUES.DELIVER_PUSH_DLQ,
  });

  await instance.createQueue(QUEUES.DELIVER_REALTIME, {
    policy: "stately",
    retryLimit: 4,
    retryDelay: 5,
    retryBackoff: true,
    retryDelayMax: 60,
    heartbeatSeconds: 30,
    deleteAfterSeconds: 86_400,
    deadLetter: QUEUES.DELIVER_REALTIME_DLQ,
  });
}

export async function getBoss(): Promise<PgBoss> {
  if (boss) {
    return boss;
  }

  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL as string,
    superviseIntervalSeconds: 30,
    maintenanceIntervalSeconds: 86_400,
    warningSlowQuerySeconds: 10,
    warningQueueSize: 5_000,
  });

  boss.on("error", (error) => {
    logger.error("pg_boss.error", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  boss.on("warning", (warning) => {
    logger.warn("pg_boss.warning", {
      warning,
    });
  });

  await boss.start();
  await createQueues(boss);

  logger.info("pg_boss.started", {
    queues: Object.values(QUEUES),
  });

  return boss;
}

export async function enqueueNotificationEventJob(
  data: NotificationEventJobData,
) {
  const instance = await getBoss();
  return instance.send(QUEUES.PROCESS_NOTIFICATION_EVENT, data, {
    singletonKey: buildSingletonKey(`event:${data.eventId}`),
    singletonSeconds: 300,
  });
}

export async function enqueuePushDeliveryJob(data: PushDeliveryJobData) {
  const instance = await getBoss();
  return instance.send(QUEUES.DELIVER_PUSH, data, {
    singletonKey: buildSingletonKey(
      `push:${data.notificationId}:${data.endpoint}`,
    ),
    singletonSeconds: 300,
  });
}

export async function enqueueDispatchNotificationJob(
  data: DispatchNotificationJobData,
) {
  const instance = await getBoss();
  return instance.send(QUEUES.DISPATCH_NOTIFICATION, data, {
    singletonKey: buildSingletonKey(`dispatch:${data.notificationId}`),
    singletonSeconds: 300,
  });
}

export async function enqueueRealtimeDeliveryJob(data: RealtimeDeliveryJobData) {
  const instance = await getBoss();
  const keyBase =
    data.eventType === "notification.created"
      ? `created:${data.notification.id}`
      : data.eventType === "notification.read"
        ? `read:${data.notificationId}`
        : `read-all:${data.driverId}:${data.timestamp}`;

  return instance.send(QUEUES.DELIVER_REALTIME, data, {
    singletonKey: buildSingletonKey(`realtime:${keyBase}`),
    singletonSeconds: 300,
  });
}

export async function stopBoss() {
  if (!boss) {
    return;
  }

  await boss.stop({
    graceful: true,
    timeout: 15_000,
  });

  boss = null;
  logger.info("pg_boss.stopped");
}
