import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../db/connection";
import { driver } from "../db/index";
import { notification } from "../db/notification-schema";

type NotificationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type InsertNotification = typeof notification.$inferInsert;

export class NotificationRepository {
  async findDriverByUserId(userId: string) {
    return db.query.driver.findFirst({
      where: eq(driver.userId, userId),
    });
  }

  async findNotifications(
    whereClause: ReturnType<typeof and>,
    limit: number,
  ) {
    return db.query.notification.findMany({
      where: whereClause,
      orderBy: [desc(notification.occurredAt), desc(notification.createdAt)],
      limit,
    });
  }

  async findNotificationByIdAndDriver(id: string, driverId: string) {
    return db.query.notification.findFirst({
      where: and(
        eq(notification.id, id),
        eq(notification.driverId, driverId),
        isNull(notification.archivedAt),
      ),
    });
  }

  async updateNotification(id: string, values: Partial<InsertNotification>) {
    const [record] = await db
      .update(notification)
      .set(values)
      .where(eq(notification.id, id))
      .returning();
    return record;
  }

  async updateNotificationsByDriver(
    driverId: string,
    values: Partial<InsertNotification>,
    extraConditions?: Parameters<typeof and>[0][],
  ) {
    const conditions = [
      eq(notification.driverId, driverId),
      ...(extraConditions ?? []),
    ];
    await db
      .update(notification)
      .set(values)
      .where(and(...conditions))
      .execute();
  }

  async upsertNotification(
    tx: NotificationTransaction,
    values: InsertNotification & { notificationKey: string; driverId: string },
  ): Promise<typeof notification.$inferSelect> {
    const [created] = await tx
      .insert(notification)
      .values(values)
      .onConflictDoUpdate({
        target: [notification.driverId, notification.notificationKey],
        set: {
          kind: values.kind,
          type: values.type,
          title: values.title,
          message: values.message,
          href: values.href,
          tag: values.tag,
          tone: values.tone,
          metadata: values.metadata,
          contentHash: values.contentHash,
          readAt: null,
          archivedAt: null,
          occurredAt: values.occurredAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return created;
  }

  async archiveNotificationsByKeys(
    tx: NotificationTransaction,
    driverId: string,
    keys: string[],
  ) {
    const now = new Date();
    await tx
      .update(notification)
      .set({ archivedAt: now, updatedAt: now })
      .where(
        and(
          eq(notification.driverId, driverId),
          eq(notification.kind, "state"),
          isNull(notification.archivedAt),
          inArray(notification.notificationKey, keys),
        ),
      );
  }

  async findNotificationByDriverAndKey(
    tx: NotificationTransaction,
    driverId: string,
    notificationKey: string,
  ) {
    return tx.query.notification.findFirst({
      where: and(
        eq(notification.driverId, driverId),
        eq(notification.notificationKey, notificationKey),
      ),
    });
  }

  async updateNotificationInTransaction(
    tx: NotificationTransaction,
    id: string,
    values: Partial<InsertNotification>,
  ) {
    const [updated] = await tx
      .update(notification)
      .set(values)
      .where(eq(notification.id, id))
      .returning();
    return updated;
  }
}
