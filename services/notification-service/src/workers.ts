import { logger } from "@shared/logger";
import { sentryServer } from "@shared/sentry";
import {
  getBoss,
  QUEUES,
  type DispatchNotificationJobData,
  type NotificationEventJobData,
  type PushDeliveryJobData,
  type RealtimeDeliveryJobData,
} from "./boss";
import { processNotificationEventJob } from "./notificationEventProcessor";
import { NotificationService } from "./notificationService";
import {
  publishCreatedNotificationRealtimeEvent,
  publishReadAllNotificationsRealtimeEvent,
  publishReadNotificationRealtimeEvent,
} from "./realtime/publisher";
import {
  sendPushToSubscription,
  type PushSubscriptionData,
} from "./pushService";

const notificationService = new NotificationService();

async function processPushDeliveryJob(job: PushDeliveryJobData) {
  const result = await sendPushToSubscription(
    job.driverId,
    {
      driverId: job.driverId,
      endpoint: job.endpoint,
      p256dh: job.p256dh,
      auth: job.auth,
    } satisfies PushSubscriptionData,
    job.payload,
  );

  if (result.status === "transient_failure") {
    throw result.error;
  }
}

async function processRealtimeDeliveryJob(job: RealtimeDeliveryJobData) {
  switch (job.eventType) {
    case "notification.created":
      await publishCreatedNotificationRealtimeEvent(job.notification, job.timestamp);
      return;
    case "notification.read":
      await publishReadNotificationRealtimeEvent(
        job.driverId,
        job.notificationId,
        job.timestamp,
      );
      return;
    case "notification.read_all":
      await publishReadAllNotificationsRealtimeEvent(job.driverId, job.timestamp);
      return;
    default:
      return;
  }
}

let workersStarted = false;

export async function startWorkers() {
  if (workersStarted) {
    return;
  }

  const boss = await getBoss();

  await boss.work<NotificationEventJobData>(
    QUEUES.PROCESS_NOTIFICATION_EVENT,
    async ([job]) => {
      logger.info("pg_boss.processing_notification_event", {
        jobId: job.id,
        eventId: job.data.eventId,
        topic: job.data.topic,
      });

      try {
        await processNotificationEventJob(job.data);
      } catch (error) {
        sentryServer.captureException(error, "system", {
          action: "processNotificationEventJob",
          values: {
            eventId: job.data.eventId,
            jobId: job.id,
            topic: job.data.topic,
          },
        });
        throw error;
      }
    },
  );

  await boss.work<PushDeliveryJobData>(
    QUEUES.DELIVER_PUSH,
    async ([job]) => {
      logger.info("pg_boss.delivering_push_notification", {
        endpoint: job.data.endpoint,
        jobId: job.id,
        notificationId: job.data.notificationId,
      });

      try {
        await processPushDeliveryJob(job.data);
      } catch (error) {
        sentryServer.captureException(error, "system", {
          action: "processPushDeliveryJob",
          values: {
            endpoint: job.data.endpoint,
            jobId: job.id,
            notificationId: job.data.notificationId,
          },
        });
        throw error;
      }
    },
  );

  await boss.work<DispatchNotificationJobData>(
    QUEUES.DISPATCH_NOTIFICATION,
    async ([job]) => {
      logger.info("pg_boss.dispatching_notification", {
        jobId: job.id,
        notificationId: job.data.notificationId,
      });

      try {
        await notificationService.dispatchNotification(job.data.notificationId);
      } catch (error) {
        sentryServer.captureException(error, "system", {
          action: "dispatchNotification",
          values: {
            jobId: job.id,
            notificationId: job.data.notificationId,
          },
        });
        throw error;
      }
    },
  );

  await boss.work<RealtimeDeliveryJobData>(
    QUEUES.DELIVER_REALTIME,
    async ([job]) => {
      logger.info("pg_boss.delivering_realtime_notification", {
        driverId: job.data.driverId,
        eventType: job.data.eventType,
        jobId: job.id,
      });

      try {
        await processRealtimeDeliveryJob(job.data);
      } catch (error) {
        sentryServer.captureException(error, "system", {
          action: "processRealtimeDeliveryJob",
          values: {
            driverId: job.data.driverId,
            eventType: job.data.eventType,
            jobId: job.id,
          },
        });
        throw error;
      }
    },
  );

  await boss.work<NotificationEventJobData>(
    QUEUES.PROCESS_NOTIFICATION_EVENT_DLQ,
    async ([job]) => {
      logger.error("pg_boss.notification_event_dlq", {
        eventId: job.data.eventId,
        jobId: job.id,
        topic: job.data.topic,
      });
      sentryServer.captureException(
        new Error("Notification event moved to DLQ"),
        "system",
        {
          action: "notificationEventDlq",
          eventId: job.data.eventId,
          jobId: job.id,
          topic: job.data.topic,
        },
      );
    },
  );

  await boss.work<PushDeliveryJobData>(
    QUEUES.DELIVER_PUSH_DLQ,
    async ([job]) => {
      logger.error("pg_boss.notification_push_dlq", {
        endpoint: job.data.endpoint,
        jobId: job.id,
        notificationId: job.data.notificationId,
      });
      sentryServer.captureException(
        new Error("Notification push delivery moved to DLQ"),
        job.data.driverId,
        {
          action: "notificationPushDlq",
          endpoint: job.data.endpoint,
          jobId: job.id,
          notificationId: job.data.notificationId,
        },
      );
    },
  );

  await boss.work<DispatchNotificationJobData>(
    QUEUES.DISPATCH_NOTIFICATION_DLQ,
    async ([job]) => {
      logger.error("pg_boss.notification_dispatch_dlq", {
        jobId: job.id,
        notificationId: job.data.notificationId,
      });
      sentryServer.captureException(
        new Error("Notification dispatch moved to DLQ"),
        "system",
        {
          action: "notificationDispatchDlq",
          jobId: job.id,
          notificationId: job.data.notificationId,
        },
      );
    },
  );

  await boss.work<RealtimeDeliveryJobData>(
    QUEUES.DELIVER_REALTIME_DLQ,
    async ([job]) => {
      const notificationId =
        job.data.eventType === "notification.created"
          ? job.data.notification.id
          : job.data.eventType === "notification.read"
            ? job.data.notificationId
            : null;

      logger.error("pg_boss.notification_realtime_dlq", {
        driverId: job.data.driverId,
        eventType: job.data.eventType,
        jobId: job.id,
      });
      sentryServer.captureException(
        new Error("Notification realtime delivery moved to DLQ"),
        job.data.driverId,
        {
          action: "notificationRealtimeDlq",
          eventType: job.data.eventType,
          jobId: job.id,
          notificationId,
        },
      );
    },
  );

  workersStarted = true;
  logger.info("pg_boss.notification_workers_started");
}
