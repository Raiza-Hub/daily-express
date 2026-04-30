import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type {
  BookingConfirmedEvent,
  DriverBankVerificationFailedEvent,
  DriverBankVerificationRequestedEvent,
  DriverBankVerifiedEvent,
  DriverIdentityCreatedEvent,
  DriverIdentityDeletedEvent,
  DriverIdentityUpdatedEvent,
  PayoutCompletedEvent,
  PayoutFailedEvent,
  TripCancelledEvent,
  TripCompletedEvent,
} from "@shared/kafka";
import type {
  DriverNotification,
  JWTPayload,
  NotificationTone,
} from "@shared/types";
import { createServiceError } from "@shared/utils";
import { reportError } from "@shared/logger";
import { sentryServer } from "@shared/sentry";
import { db } from "../db/db";
import {
  consumedEvent,
  driverIdentity,
  notification,
  pushSubscription,
} from "../db/schema";
import { loadConfig } from "./config";
import {
  enqueueDispatchNotificationJob,
  enqueuePushDeliveryJob,
  enqueueRealtimeDeliveryJob,
} from "./boss";
import type { PushNotificationPayload } from "./pushService";

type NotificationRecord = typeof notification.$inferSelect;
type DriverIdentityProjectionEvent =
  | DriverIdentityCreatedEvent
  | DriverIdentityUpdatedEvent;

interface NotificationDescriptor {
  notificationKey: string;
  kind: "event" | "state";
  type: string;
  title: string;
  message: string;
  href?: string | null;
  tag: string;
  tone: NotificationTone;
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date;
}

interface EnsuredNotificationResult {
  notification: DriverNotification | null;
  shouldDeliver: boolean;
}

const MAX_LIMIT = 50;
const BANK_STATE_KEYS = [
  "bank-verification-failed",
  "bank-verification-pending",
  "bank-verification-verified",
] as const;

export class NotificationService {
  private readonly config = loadConfig();

  async getDriverIdForUser(user: JWTPayload): Promise<string> {
    return this.resolveDriverId(user);
  }

  private async resolveDriverId(user: JWTPayload): Promise<string> {
    const mapping = await db.query.driverIdentity.findFirst({
      where: eq(driverIdentity.userId, user.userId),
    });

    if (mapping) {
      return mapping.driverId;
    }

    throw createServiceError("Driver identity not found", 404);
  }

  private buildContentHash(input: NotificationDescriptor) {
    return createHash("sha256")
      .update(
        JSON.stringify({
          kind: input.kind,
          type: input.type,
          title: input.title,
          message: input.message,
          href: input.href || null,
          tag: input.tag,
          tone: input.tone,
          metadata: input.metadata || null,
        }),
      )
      .digest("hex");
  }

  private formatAmountMinor(amountMinor: number, currency = "NGN") {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  }

  private formatTripDate(value: string | Date) {
    return new Intl.DateTimeFormat("en-NG", {
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  }

  private mapRecordToNotification(
    record: NotificationRecord,
  ): DriverNotification {
    return {
      id: record.id,
      driverId: record.driverId,
      notificationKey: record.notificationKey,
      kind: record.kind,
      type: record.type,
      title: record.title,
      message: record.message,
      href: record.href,
      tag: record.tag,
      tone: record.tone,
      metadata: (record.metadata as Record<string, unknown> | null) || null,
      readAt: record.readAt,
      occurredAt: record.occurredAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private clampLimit(limit?: number) {
    if (!limit || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
  }

  private buildPushPayload(
    notificationRecord: DriverNotification,
  ): PushNotificationPayload {
    return {
      title: notificationRecord.title,
      message: notificationRecord.message,
      tag: notificationRecord.tag,
      href: notificationRecord.href || undefined,
      tone: notificationRecord.tone,
    };
  }

  private getNotificationTimestamp(notificationRecord: DriverNotification) {
    return new Date(
      notificationRecord.updatedAt ||
        notificationRecord.createdAt ||
        notificationRecord.occurredAt,
    ).getTime();
  }

  private async queueCreatedNotificationDeliveries(
    notificationRecord: DriverNotification,
  ) {
    await enqueueDispatchNotificationJob({
      notificationId: notificationRecord.id,
    });
  }

  private async queueReadNotificationUpdate(
    driverId: string,
    notificationId: string,
    timestamp: number,
  ) {
    try {
      await enqueueRealtimeDeliveryJob({
        eventType: "notification.read",
        driverId,
        notificationId,
        timestamp,
      });
    } catch (error) {
      reportError(error as Error, {
        source: "notifications",
        message: "Failed to enqueue read notification realtime event",
        driverId,
        notificationId,
      });
      sentryServer.captureException(error, driverId, {
        action: "queueReadNotificationUpdate",
        driverId,
        notificationId,
        timestamp,
      });
    }
  }

  private async queueReadAllNotificationUpdate(
    driverId: string,
    timestamp: number,
  ) {
    try {
      await enqueueRealtimeDeliveryJob({
        eventType: "notification.read_all",
        driverId,
        timestamp,
      });
    } catch (error) {
      reportError(error as Error, {
        source: "notifications",
        message: "Failed to enqueue read-all notification realtime event",
        driverId,
      });
      sentryServer.captureException(error, driverId, {
        action: "queueReadAllNotificationUpdate",
        driverId,
        timestamp,
      });
    }
  }

  private async insertNotificationRecord(
    tx: any,
    driverId: string,
    descriptor: NotificationDescriptor,
  ): Promise<NotificationRecord> {
    const [created] = await tx
      .insert(notification)
      .values({
        driverId,
        notificationKey: descriptor.notificationKey,
        kind: descriptor.kind,
        type: descriptor.type,
        title: descriptor.title,
        message: descriptor.message,
        href: descriptor.href || null,
        tag: descriptor.tag,
        tone: descriptor.tone,
        metadata: descriptor.metadata || null,
        contentHash: this.buildContentHash(descriptor),
        occurredAt: descriptor.occurredAt || new Date(),
      })
      .returning();

    return created;
  }

  private async ensureEventNotification(
    eventId: string,
    topic: string,
    driverId: string,
    descriptor: NotificationDescriptor,
  ): Promise<EnsuredNotificationResult> {
    return db.transaction(async (tx) => {
      const processed = await tx.query.consumedEvent.findFirst({
        where: eq(consumedEvent.eventId, eventId),
      });

      if (processed) {
        const existing = await tx.query.notification.findFirst({
          where: and(
            eq(notification.driverId, driverId),
            eq(notification.notificationKey, descriptor.notificationKey),
          ),
        });

        return {
          notification: existing ? this.mapRecordToNotification(existing) : null,
          shouldDeliver: false,
        };
      }

      const created = await this.insertNotificationRecord(tx, driverId, descriptor);

      await tx.insert(consumedEvent).values({
        eventId,
        topic,
      });

      return {
        notification: this.mapRecordToNotification(created),
        shouldDeliver: true,
      };
    });
  }

  private async ensureStateNotification(
    eventId: string,
    topic: string,
    driverId: string,
    descriptor: NotificationDescriptor,
    managedKeys: readonly string[],
  ): Promise<EnsuredNotificationResult> {
    const now = new Date();
    const contentHash = this.buildContentHash(descriptor);

    return db.transaction(async (tx) => {
      const processed = await tx.query.consumedEvent.findFirst({
        where: eq(consumedEvent.eventId, eventId),
      });

      if (processed) {
        const existing = await tx.query.notification.findFirst({
          where: and(
            eq(notification.driverId, driverId),
            eq(notification.notificationKey, descriptor.notificationKey),
          ),
        });

        return {
          notification: existing ? this.mapRecordToNotification(existing) : null,
          shouldDeliver: false,
        };
      }

      const staleKeys = managedKeys.filter(
        (key) => key !== descriptor.notificationKey,
      );
      if (staleKeys.length > 0) {
        await tx
          .update(notification)
          .set({
            archivedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(notification.driverId, driverId),
              eq(notification.kind, "state"),
              isNull(notification.archivedAt),
              inArray(notification.notificationKey, [...staleKeys]),
            ),
          );
      }

      const existing = await tx.query.notification.findFirst({
        where: and(
          eq(notification.driverId, driverId),
          eq(notification.notificationKey, descriptor.notificationKey),
        ),
      });

      let savedRecord: NotificationRecord;
      let shouldDeliver = true;

      if (!existing) {
        savedRecord = await this.insertNotificationRecord(tx, driverId, descriptor);
      } else {
        const contentChanged =
          existing.contentHash !== contentHash || existing.archivedAt !== null;
        shouldDeliver = contentChanged;

        const [updated] = await tx
          .update(notification)
          .set({
            type: descriptor.type,
            title: descriptor.title,
            message: descriptor.message,
            href: descriptor.href || null,
            tag: descriptor.tag,
            tone: descriptor.tone,
            metadata: descriptor.metadata || null,
            contentHash,
            archivedAt: null,
            occurredAt: contentChanged
              ? descriptor.occurredAt || now
              : existing.occurredAt,
            readAt: contentChanged ? null : existing.readAt,
            updatedAt: now,
          })
          .where(eq(notification.id, existing.id))
          .returning();

        savedRecord = updated;
      }

      await tx.insert(consumedEvent).values({
        eventId,
        topic,
      });

      return {
        notification: this.mapRecordToNotification(savedRecord),
        shouldDeliver,
      };
    });
  }

  async getNotifications(
    user: JWTPayload,
    options?: { limit?: number; cursor?: string; unreadOnly?: boolean },
  ): Promise<{
    notifications: DriverNotification[];
    nextCursor: string | null;
  }> {
    let driverId: string;
    try {
      driverId = await this.resolveDriverId(user);
    } catch (error) {
      if (
        error instanceof Error &&
        "statusCode" in error &&
        (error as { statusCode?: number }).statusCode === 404
      ) {
        // Identity projection can lag right after driver creation; avoid a transient hard failure.
        return {
          notifications: [],
          nextCursor: null,
        };
      }

      throw error;
    }
    const unreadFilters = options?.unreadOnly
      ? [isNull(notification.readAt)]
      : [];

    let whereClause = and(
      eq(notification.driverId, driverId),
      isNull(notification.archivedAt),
      ...unreadFilters,
    );

    if (options?.cursor) {
      const [occurredAt, createdAt] = options.cursor.split("|");
      const occurredAtDate = new Date(occurredAt);
      const createdAtDate = new Date(createdAt);

      whereClause = and(
        whereClause,
        or(
          lt(notification.occurredAt, occurredAtDate),
          and(
            eq(notification.occurredAt, occurredAtDate),
            lt(notification.createdAt, createdAtDate),
          ),
        ),
      );
    }

    const limit = this.clampLimit(options?.limit);
    const notifications = await db.query.notification.findMany({
      where: whereClause,
      orderBy: [desc(notification.occurredAt), desc(notification.createdAt)],
      limit: limit + 1,
    });

    let nextCursor: string | null = null;
    if (notifications.length > limit) {
      const nextItem = notifications[limit];
      nextCursor = `${nextItem.occurredAt.toISOString()}|${nextItem.createdAt.toISOString()}`;
    }

    const result = notifications
      .slice(0, limit)
      .map((item) => this.mapRecordToNotification(item));

    return {
      notifications: result,
      nextCursor,
    };
  }

  async markNotificationRead(
    user: JWTPayload,
    id: string,
  ): Promise<DriverNotification> {
    const driverId = await this.resolveDriverId(user);
    const existing = await db.query.notification.findFirst({
      where: and(
        eq(notification.id, id),
        eq(notification.driverId, driverId),
        isNull(notification.archivedAt),
      ),
    });

    if (!existing) {
      throw createServiceError("Notification not found", 404);
    }

    if (existing.readAt) {
      return this.mapRecordToNotification(existing);
    }

    const readAt = new Date();
    const [updated] = await db
      .update(notification)
      .set({
        readAt,
        updatedAt: readAt,
      })
      .where(eq(notification.id, id))
      .returning();

    const updatedNotification = this.mapRecordToNotification(updated);
    await this.queueReadNotificationUpdate(driverId, id, readAt.getTime());
    return updatedNotification;
  }

  async markAllNotificationsRead(user: JWTPayload): Promise<void> {
    const driverId = await this.resolveDriverId(user);
    const readAt = new Date();

    const updatedNotifications = await db
      .update(notification)
      .set({
        readAt,
        updatedAt: readAt,
      })
      .where(
        and(
          eq(notification.driverId, driverId),
          isNull(notification.archivedAt),
          isNull(notification.readAt),
        ),
      )
      .returning({
        id: notification.id,
      });

    if (updatedNotifications.length === 0) {
      return;
    }

    await this.queueReadAllNotificationUpdate(driverId, readAt.getTime());
  }

  async handleBookingConfirmed(event: BookingConfirmedEvent, topic: string) {
    const formattedDate = new Intl.DateTimeFormat("en-NG", {
      month: "short",
      day: "numeric",
    }).format(new Date(event.payload.tripDate));

    const message = event.payload.passengerName
      ? `This trip was booked by ${event.payload.passengerName} for ${formattedDate}.`
      : `This trip was booked for ${formattedDate}.`;

    const result = await this.ensureEventNotification(
      event.eventId,
      topic,
      event.payload.driverId,
      {
        notificationKey: `event:${event.eventId}`,
        kind: "event",
        type: "booking_confirmed",
        title: "New booking confirmed",
        message,
        href: "/routes",
        tag: "Booking",
        tone: "positive",
        metadata: {
          bookingId: event.payload.bookingId,
          tripId: event.payload.tripId,
          routeId: event.payload.routeId,
        },
        occurredAt: new Date(event.occurredAt),
      },
    );

    if (result.notification && result.shouldDeliver) {
      await this.queueCreatedNotificationDeliveries(result.notification);
    }
  }

  async handleTripCompleted(event: TripCompletedEvent, topic: string) {
    const result = await this.ensureEventNotification(
      event.eventId,
      topic,
      event.payload.driverId,
      {
        notificationKey: `event:${event.eventId}`,
        kind: "event",
        type: "trip_completed",
        title: "Trip completed",
        message: `${event.payload.pickupTitle} -> ${event.payload.dropoffTitle} for ${this.formatTripDate(
          event.payload.tripDate,
        )} is completed.`,
        href: "/payouts",
        tag: "Trip",
        tone: "positive",
        metadata: {
          tripId: event.payload.tripId,
        },
        occurredAt: new Date(event.payload.completedAt),
      },
    );

    if (result.notification && result.shouldDeliver) {
      await this.queueCreatedNotificationDeliveries(result.notification);
    }
  }

  async handleTripCancelled(event: TripCancelledEvent, topic: string) {
    const result = await this.ensureEventNotification(
      event.eventId,
      topic,
      event.payload.driverId,
      {
        notificationKey: `event:${event.eventId}`,
        kind: "event",
        type: "trip_cancelled",
        title: "Trip cancelled",
        message:
          "A scheduled trip was cancelled. Review your routes if you need to publish a replacement.",
        href: "/routes",
        tag: "Trip",
        tone: "attention",
        metadata: {
          tripId: event.payload.tripId,
        },
        occurredAt: new Date(event.payload.cancelledAt),
      },
    );

    if (result.notification && result.shouldDeliver) {
      await this.queueCreatedNotificationDeliveries(result.notification);
    }
  }

  async handlePayoutCompleted(event: PayoutCompletedEvent, topic: string) {
    const result = await this.ensureEventNotification(
      event.eventId,
      topic,
      event.payload.driverId,
      {
        notificationKey: `event:${event.eventId}`,
        kind: "event",
        type: "payout_completed",
        title: "Payout sent successfully",
        message: `${this.formatAmountMinor(
          event.payload.amountMinor,
          event.payload.currency,
        )} was transferred to your account.`,
        href: "/payouts",
        tag: "Paid",
        tone: "positive",
        metadata: {
          payoutId: event.payload.payoutId,
          reference: event.payload.reference,
        },
        occurredAt: new Date(event.occurredAt),
      },
    );

    if (result.notification && result.shouldDeliver) {
      await this.queueCreatedNotificationDeliveries(result.notification);
    }
  }

  async handlePayoutFailed(event: PayoutFailedEvent, topic: string) {
    const result = await this.ensureEventNotification(
      event.eventId,
      topic,
      event.payload.driverId,
      {
        notificationKey: `event:${event.eventId}`,
        kind: "event",
        type: "payout_failed",
        title: "A payout needs review",
        message:
          event.payload.failureReason ||
          `${this.formatAmountMinor(
            event.payload.amountMinor,
            event.payload.currency,
          )} could not be transferred successfully.`,
        href: "/payouts",
        tag: "Action needed",
        tone: "critical",
        metadata: {
          payoutId: event.payload.payoutId,
          reference: event.payload.reference,
        },
        occurredAt: new Date(event.occurredAt),
      },
    );

    if (result.notification && result.shouldDeliver) {
      await this.queueCreatedNotificationDeliveries(result.notification);
    }
  }

  async handleBankVerificationRequested(
    event: DriverBankVerificationRequestedEvent,
    topic: string,
  ) {
    const result = await this.ensureStateNotification(
      event.eventId,
      topic,
      event.payload.driverId,
      {
        notificationKey: "bank-verification-pending",
        kind: "state",
        type: "bank_verification_pending",
        title: "Bank verification in progress",
        message:
          "We are still verifying your payout account. Automatic payouts stay on hold until verification finishes.",
        href: "/settings/bank-details",
        tag: "Verification",
        tone: "attention",
        occurredAt: new Date(event.occurredAt),
      },
      BANK_STATE_KEYS,
    );

    if (result.notification && result.shouldDeliver) {
      await this.queueCreatedNotificationDeliveries(result.notification);
    }
  }

  async handleDriverIdentityCreated(
    event: DriverIdentityCreatedEvent,
    topic: string,
  ) {
    await this.upsertDriverIdentityProjection(event, topic);
  }

  async handleDriverIdentityUpdated(
    event: DriverIdentityUpdatedEvent,
    topic: string,
  ) {
    await this.upsertDriverIdentityProjection(event, topic);
  }

  async handleDriverIdentityDeleted(
    event: DriverIdentityDeletedEvent,
    topic: string,
  ) {
    const eventOccurredAt = new Date(event.occurredAt);

    await db.transaction(async (tx) => {
      const processed = await tx.query.consumedEvent.findFirst({
        where: eq(consumedEvent.eventId, event.eventId),
      });

      if (processed) {
        return;
      }

      const existing = await tx.query.driverIdentity.findFirst({
        where: or(
          eq(driverIdentity.driverId, event.payload.driverId),
          eq(driverIdentity.userId, event.payload.userId),
        ),
      });

      if (
        existing &&
        existing.sourceOccurredAt.getTime() <= eventOccurredAt.getTime()
      ) {
        await tx.delete(driverIdentity).where(
          or(
            eq(driverIdentity.driverId, existing.driverId),
            eq(driverIdentity.userId, existing.userId),
          ),
        );
      }

      await tx.insert(consumedEvent).values({
        eventId: event.eventId,
        topic,
      });
    });
  }

  private async upsertDriverIdentityProjection(
    event: DriverIdentityProjectionEvent,
    topic: string,
  ) {
    const eventOccurredAt = new Date(event.occurredAt);

    await db.transaction(async (tx) => {
      const processed = await tx.query.consumedEvent.findFirst({
        where: eq(consumedEvent.eventId, event.eventId),
      });

      if (processed) {
        return;
      }

      const existing = await tx.query.driverIdentity.findFirst({
        where: or(
          eq(driverIdentity.driverId, event.payload.driverId),
          eq(driverIdentity.userId, event.payload.userId),
        ),
      });

      const isStale =
        existing &&
        existing.sourceOccurredAt.getTime() > eventOccurredAt.getTime();

      if (!isStale) {
        if (!existing) {
          await tx.insert(driverIdentity).values({
            driverId: event.payload.driverId,
            userId: event.payload.userId,
            sourceOccurredAt: eventOccurredAt,
            updatedAt: new Date(),
          });
        } else if (
          existing.driverId === event.payload.driverId &&
          existing.userId === event.payload.userId
        ) {
          await tx
            .update(driverIdentity)
            .set({
              sourceOccurredAt: eventOccurredAt,
              updatedAt: new Date(),
            })
            .where(eq(driverIdentity.driverId, existing.driverId));
        } else {
          await tx.delete(driverIdentity).where(
            or(
              eq(driverIdentity.driverId, existing.driverId),
              eq(driverIdentity.userId, existing.userId),
            ),
          );

          await tx.insert(driverIdentity).values({
            driverId: event.payload.driverId,
            userId: event.payload.userId,
            sourceOccurredAt: eventOccurredAt,
            updatedAt: new Date(),
          });
        }
      }

      await tx.insert(consumedEvent).values({
        eventId: event.eventId,
        topic,
      });
    });
  }

  async handleBankVerified(event: DriverBankVerifiedEvent, topic: string) {
    const result = await this.ensureStateNotification(
      event.eventId,
      topic,
      event.payload.driverId,
      {
        notificationKey: "bank-verification-verified",
        kind: "state",
        type: "bank_verification_verified",
        title: "Payout account verified",
        message: "Your bank account is verified and ready for automatic payouts.",
        href: "/settings/bank-details",
        tag: "Verified",
        tone: "positive",
        occurredAt: new Date(event.occurredAt),
      },
      BANK_STATE_KEYS,
    );

    if (result.notification && result.shouldDeliver) {
      await this.queueCreatedNotificationDeliveries(result.notification);
    }
  }

  async handleBankVerificationFailed(
    event: DriverBankVerificationFailedEvent,
    topic: string,
  ) {
    const result = await this.ensureStateNotification(
      event.eventId,
      topic,
      event.payload.driverId,
      {
        notificationKey: "bank-verification-failed",
        kind: "state",
        type: "bank_verification_failed",
        title: "Bank details need attention",
        message:
          event.payload.reason ||
          "Your payout account could not be verified. Update your bank details to resume payouts.",
        href: "/settings/bank-details",
        tag: "Payout issue",
        tone: "critical",
        occurredAt: new Date(event.occurredAt),
      },
      BANK_STATE_KEYS,
    );

    if (result.notification && result.shouldDeliver) {
      await this.queueCreatedNotificationDeliveries(result.notification);
    }
  }

  async dispatchNotification(notificationId: string): Promise<void> {
    const record = await db.query.notification.findFirst({
      where: eq(notification.id, notificationId),
    });

    if (!record || record.archivedAt) {
      return;
    }

    const notificationRecord = this.mapRecordToNotification(record);
    const pushPayload = this.buildPushPayload(notificationRecord);

    await enqueueRealtimeDeliveryJob({
      eventType: "notification.created",
      driverId: notificationRecord.driverId,
      notification: notificationRecord,
      timestamp: this.getNotificationTimestamp(notificationRecord),
    });

    const subscriptions = await db.query.pushSubscription.findMany({
      where: eq(pushSubscription.driverId, notificationRecord.driverId),
      columns: {
        endpoint: true,
        p256dh: true,
        auth: true,
      },
    });

    await Promise.all(
      subscriptions.map((subscription) =>
        enqueuePushDeliveryJob({
          notificationId: notificationRecord.id,
          driverId: notificationRecord.driverId,
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          payload: pushPayload,
        }),
      ),
    );
  }
}
