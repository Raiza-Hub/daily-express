import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type { DriverNotification, JWTPayload, NotificationTone } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { db } from "../db/connection";
import { driver } from "../db/index";
import { notification } from "../db/notification-schema";
import {
  publishNotificationCreatedInBackground,
  publishNotificationReadAllInBackground,
  publishNotificationReadInBackground,
} from "./realtime";

const MAX_LIMIT = 50;
const BANK_VERIFICATION_NOTIFICATION_KEYS = [
  "bank-verification-failed",
  "bank-verification-pending",
  "bank-verification-verified",
] as const;

export interface NotificationDescriptor {
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

type NotificationWriter = {
  insert: typeof db.insert;
};
type NotificationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class NotificationService {
  async resolveDriverId(userId: string): Promise<string> {
    const driverRecord = await db.query.driver.findFirst({
      where: eq(driver.userId, userId),
    });

    if (!driverRecord) {
      throw createServiceError("Driver not found", 404);
    }

    return driverRecord.id;
  }

  private buildContentHash(input: NotificationDescriptor): string {
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

  private mapRecordToNotification(
    record: typeof notification.$inferSelect,
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

  private clampLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
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
      driverId = await this.resolveDriverId(user.userId);
    } catch {
      return {
        notifications: [],
        nextCursor: null,
      };
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
    const driverId = await this.resolveDriverId(user.userId);
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

    publishNotificationReadInBackground(driverId, id);

    return updatedNotification;
  }

  async markAllNotificationsRead(user: JWTPayload): Promise<void> {
    const driverId = await this.resolveDriverId(user.userId);
    const readAt = new Date();

    await db
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
      .execute();

    publishNotificationReadAllInBackground(driverId);
  }

  async createNotification(
    userId: string,
    descriptor: NotificationDescriptor,
  ): Promise<DriverNotification> {
    const driverId = await this.resolveDriverId(userId);
    const notificationRecord = await this.createForDriverInTransaction(
      db,
      driverId,
      descriptor,
    );

    publishNotificationCreatedInBackground(notificationRecord);

    return notificationRecord;
  }

  async createForDriverInTransaction(
    tx: NotificationWriter,
    driverId: string,
    descriptor: NotificationDescriptor,
  ): Promise<DriverNotification> {
    const contentHash = this.buildContentHash(descriptor);

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
        contentHash,
        occurredAt: descriptor.occurredAt || new Date(),
      })
      .onConflictDoUpdate({
        target: [notification.driverId, notification.notificationKey],
        set: {
          kind: descriptor.kind,
          type: descriptor.type,
          title: descriptor.title,
          message: descriptor.message,
          href: descriptor.href || null,
          tag: descriptor.tag,
          tone: descriptor.tone,
          metadata: descriptor.metadata || null,
          contentHash,
          readAt: null,
          archivedAt: null,
          occurredAt: descriptor.occurredAt || new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    return this.mapRecordToNotification(created);
  }

  async createBankVerificationStateInTransaction(
    tx: NotificationTransaction,
    driverId: string,
    descriptor: NotificationDescriptor,
  ): Promise<EnsuredNotificationResult> {
    const now = new Date();
    const contentHash = this.buildContentHash(descriptor);
    const staleKeys = BANK_VERIFICATION_NOTIFICATION_KEYS.filter(
      (key) => key !== descriptor.notificationKey,
    );

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

    const existing = await tx.query.notification.findFirst({
      where: and(
        eq(notification.driverId, driverId),
        eq(notification.notificationKey, descriptor.notificationKey),
      ),
    });

    if (!existing) {
      const created = await this.createForDriverInTransaction(
        tx,
        driverId,
        descriptor,
      );

      return {
        notification: created,
        shouldDeliver: true,
      };
    }

    const contentChanged =
      existing.contentHash !== contentHash || existing.archivedAt !== null;

    const [updated] = await tx
      .update(notification)
      .set({
        kind: descriptor.kind,
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

    return {
      notification: this.mapRecordToNotification(updated),
      shouldDeliver: contentChanged,
    };
  }
}
