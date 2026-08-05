import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/connection";
import { driver } from "../db/index";
import { notification } from "../db/notification-schema";

import type { DbTransaction } from "../db/connection";
type NotificationTransaction = DbTransaction;
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
      orderBy: [desc(notification.updatedAt), desc(notification.createdAt), desc(notification.id)],
      limit,
    });
  }

  async countUnreadByDriver(driverId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notification)
      .where(
        and(
          eq(notification.driverId, driverId),
          isNull(notification.readAt),
        ),
      );
    return Number(result?.count ?? 0);
  }

  async findNotificationByIdAndDriver(id: string, driverId: string) {
    return db.query.notification.findFirst({
      where: and(
        eq(notification.id, id),
        eq(notification.driverId, driverId),
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
          type: values.type,
          title: values.title,
          message: values.message,
          href: values.href,
          tag: values.tag,
          tone: values.tone,
          contentHash: values.contentHash,
          readAt: null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return created;
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
