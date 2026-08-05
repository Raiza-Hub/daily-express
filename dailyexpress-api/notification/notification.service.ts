import { createHash } from "node:crypto";
import { and, eq, lt, or } from "drizzle-orm";
import type { DriverNotification, JWTPayload } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { notification } from "../db/notification-schema";
import { NotificationRepository } from "./notification.repository";
import { db } from "../db/connection";

export interface NotificationInput {
  notificationKey: string;
  type: string;
  title: string;
  message: string;
  href?: string | null;
  tag: string;
  tone: "critical" | "attention" | "positive" | "info";
}

interface UpsertNotificationResult {
  notification: DriverNotification | null;
  shouldDeliver: boolean;
}

type NotificationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const MAX_LIMIT = 50;

export class NotificationService {
  constructor(private repo = new NotificationRepository()) {}

  private async resolveDriverId(userId: string): Promise<string> {
    const driverRecord = await this.repo.findDriverByUserId(userId);
    if (!driverRecord) {
      throw createServiceError("Driver not found", 404);
    }
    return driverRecord.id;
  }

  private hashContent(input: NotificationInput): string {
    return createHash("sha256")
      .update(
        JSON.stringify({
          type: input.type,
          title: input.title,
          message: input.message,
          href: input.href || null,
          tag: input.tag,
          tone: input.tone,
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
      type: record.type,
      title: record.title,
      message: record.message,
      href: record.href,
      tag: record.tag,
      tone: record.tone,
      readAt: record.readAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) {
      return 20;
    }
    return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
  }

  async getNotifications(
    user: JWTPayload,
    options?: { limit?: number; cursor?: string },
  ): Promise<{
    notifications: DriverNotification[];
    nextCursor: string | null;
    unreadCount: number;
  }> {
    let driverId: string;
    try {
      driverId = await this.resolveDriverId(user.userId);
    } catch {
      return { notifications: [], nextCursor: null, unreadCount: 0 };
    }

    const unreadCount = await this.repo.countUnreadByDriver(driverId);

    let whereClause = and(
      eq(notification.driverId, driverId),
    );

    if (options?.cursor) {
      const [updatedAt, createdAt, id] = options.cursor.split("|");
      const updatedAtDate = new Date(updatedAt);
      const createdAtDate = new Date(createdAt);

      whereClause = and(
        whereClause,
        or(
          lt(notification.updatedAt, updatedAtDate),
          and(
            eq(notification.updatedAt, updatedAtDate),
            lt(notification.createdAt, createdAtDate),
          ),
          and(
            eq(notification.updatedAt, updatedAtDate),
            eq(notification.createdAt, createdAtDate),
            lt(notification.id, id),
          ),
        ),
      );
    }

    const limit = this.normalizeLimit(options?.limit);
    const notifications = await this.repo.findNotifications(
      whereClause,
      limit + 1,
    );

    let nextCursor: string | null = null;
    if (notifications.length > limit) {
      const nextItem = notifications[limit];
      nextCursor = `${nextItem.updatedAt.toISOString()}|${nextItem.createdAt.toISOString()}|${nextItem.id}`;
    }

    const result = notifications
      .slice(0, limit)
      .map((item) => this.mapRecordToNotification(item));

    return { notifications: result, nextCursor, unreadCount };
  }

  async markNotificationRead(
    user: JWTPayload,
    id: string,
  ): Promise<DriverNotification> {
    const driverId = await this.resolveDriverId(user.userId);
    const existing = await this.repo.findNotificationByIdAndDriver(id, driverId);

    if (!existing) {
      throw createServiceError("Notification not found", 404);
    }

    if (existing.readAt) {
      return this.mapRecordToNotification(existing);
    }

    const readAt = new Date();
    const updated = await this.repo.updateNotification(id, {
      readAt,
    });

    const updatedNotification = this.mapRecordToNotification(updated);
    return updatedNotification;
  }

  async createForDriverInTransaction(
    tx: NotificationTransaction,
    driverId: string,
    descriptor: NotificationInput,
  ): Promise<DriverNotification> {
    const contentHash = this.hashContent(descriptor);

    const created = await this.repo.upsertNotification(tx, {
      driverId,
      notificationKey: descriptor.notificationKey,
      type: descriptor.type,
      title: descriptor.title,
      message: descriptor.message,
      href: descriptor.href || null,
      tag: descriptor.tag,
      tone: descriptor.tone,
      contentHash,
    });

    return this.mapRecordToNotification(created);
  }

  async createBankVerificationStateInTransaction(
    tx: NotificationTransaction,
    driverId: string,
    descriptor: NotificationInput,
  ): Promise<UpsertNotificationResult> {
    const now = new Date();
    const contentHash = this.hashContent(descriptor);

    const existing = await this.repo.findNotificationByDriverAndKey(
      tx,
      driverId,
      descriptor.notificationKey,
    );

    if (!existing) {
      const created = await this.createForDriverInTransaction(
        tx,
        driverId,
        descriptor,
      );
      return { notification: created, shouldDeliver: true };
    }

    const contentChanged = existing.contentHash !== contentHash;

    const updated = await this.repo.updateNotificationInTransaction(
      tx,
      existing.id,
      {
        type: descriptor.type,
        title: descriptor.title,
        message: descriptor.message,
        href: descriptor.href || null,
        tag: descriptor.tag,
        tone: descriptor.tone,
        contentHash,
        readAt: contentChanged ? null : existing.readAt,
        updatedAt: now,
      },
    );

    return {
      notification: this.mapRecordToNotification(updated),
      shouldDeliver: contentChanged,
    };
  }

  async createKycVerificationStateInTransaction(
    tx: NotificationTransaction,
    driverId: string,
    descriptor: NotificationInput,
  ): Promise<UpsertNotificationResult> {
    const now = new Date();
    const contentHash = this.hashContent(descriptor);

    const existing = await this.repo.findNotificationByDriverAndKey(
      tx,
      driverId,
      descriptor.notificationKey,
    );

    if (!existing) {
      const created = await this.createForDriverInTransaction(
        tx,
        driverId,
        descriptor,
      );
      return { notification: created, shouldDeliver: true };
    }

    const contentChanged = existing.contentHash !== contentHash;

    const updated = await this.repo.updateNotificationInTransaction(
      tx,
      existing.id,
      {
        type: descriptor.type,
        title: descriptor.title,
        message: descriptor.message,
        href: descriptor.href || null,
        tag: descriptor.tag,
        tone: descriptor.tone,
        contentHash,
        readAt: contentChanged ? null : existing.readAt,
        updatedAt: now,
      },
    );

    return {
      notification: this.mapRecordToNotification(updated),
      shouldDeliver: contentChanged,
    };
  }
}

export const notificationService = new NotificationService();
