import { createHash } from "node:crypto";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import type { DriverNotification, JWTPayload } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { notification } from "../db/notification-schema";
import {
  publishNotificationReadAllInBackground,
  publishNotificationReadInBackground,
} from "./realtime";
import { NotificationRepository } from "./notification.repository";
import { db } from "../db/connection";

export interface NotificationInput {
  notificationKey: string;
  kind: "event" | "state";
  type: string;
  title: string;
  message: string;
  href?: string | null;
  tag: string;
  tone: "critical" | "attention" | "positive" | "info";
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date;
}

interface UpsertNotificationResult {
  notification: DriverNotification | null;
  shouldDeliver: boolean;
}

type NotificationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const MAX_LIMIT = 50;
const BANK_VERIFICATION_STATE_KEYS = [
  "account-setup-pending",
  "bank-verification-failed",
  "bank-verification-pending",
  "bank-verification-verified",
] as const;

const KYC_VERIFICATION_STATE_KEYS = [
  "account-setup-pending",
  "kyc-verification-failed",
  "kyc-verification-pending",
  "kyc-verification-verified",
] as const;

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

  private normalizeLimit(limit?: number): number {
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
    unreadCount: number;
  }> {
    let driverId: string;
    try {
      driverId = await this.resolveDriverId(user.userId);
    } catch {
      return { notifications: [], nextCursor: null, unreadCount: 0 };
    }

    const unreadCount = await this.repo.countUnreadByDriver(driverId);

    const unreadFilters = options?.unreadOnly
      ? [isNull(notification.readAt)]
      : [];

    let whereClause = and(
      eq(notification.driverId, driverId),
      isNull(notification.archivedAt),
      ...unreadFilters,
    );

    if (options?.cursor) {
      const [occurredAt, createdAt, id] = options.cursor.split("|");
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
          and(
            eq(notification.occurredAt, occurredAtDate),
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
      nextCursor = `${nextItem.occurredAt.toISOString()}|${nextItem.createdAt.toISOString()}|${nextItem.id}`;
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
      updatedAt: readAt,
    });

    const updatedNotification = this.mapRecordToNotification(updated);
    publishNotificationReadInBackground(driverId, id);
    return updatedNotification;
  }

  async markAllNotificationsRead(user: JWTPayload): Promise<void> {
    const driverId = await this.resolveDriverId(user.userId);
    const readAt = new Date();

    await this.repo.updateNotificationsByDriver(
      driverId,
      { readAt, updatedAt: readAt },
      [isNull(notification.archivedAt), isNull(notification.readAt)],
    );

    publishNotificationReadAllInBackground(driverId);
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
    const staleKeys = BANK_VERIFICATION_STATE_KEYS.filter(
      (key) => key !== descriptor.notificationKey,
    );

    await this.repo.archiveNotificationsByKeys(tx, driverId, [...staleKeys]);

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

    const contentChanged =
      existing.contentHash !== contentHash || existing.archivedAt !== null;

    const updated = await this.repo.updateNotificationInTransaction(
      tx,
      existing.id,
      {
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
    const staleKeys = KYC_VERIFICATION_STATE_KEYS.filter(
      (key) => key !== descriptor.notificationKey,
    );

    await this.repo.archiveNotificationsByKeys(tx, driverId, [...staleKeys]);

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

    const contentChanged =
      existing.contentHash !== contentHash || existing.archivedAt !== null;

    const updated = await this.repo.updateNotificationInTransaction(
      tx,
      existing.id,
      {
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
      },
    );

    return {
      notification: this.mapRecordToNotification(updated),
      shouldDeliver: contentChanged,
    };
  }
}

export const notificationService = new NotificationService();
