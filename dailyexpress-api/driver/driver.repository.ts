import { eq } from "drizzle-orm";
import { db } from "../db/connection";
import { driver, driverStats, driverProfileImageUpload } from "../db/index";

type DriverTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DriverRecord = typeof driver.$inferSelect;
type DriverStatsRecord = typeof driverStats.$inferSelect;
type InsertDriverImage = typeof driverProfileImageUpload.$inferInsert;

export class DriverRepository {
  async findDriverByUserId(userId: string): Promise<DriverRecord | null> {
    return (await db.query.driver.findFirst({ where: eq(driver.userId, userId) })) ?? null;
  }

  async findDriverStatsByDriverId(driverId: string): Promise<DriverStatsRecord | null> {
    return (await db.query.driverStats.findFirst({ where: eq(driverStats.driverId, driverId) })) ?? null;
  }

  async insertDriver(
    tx: DriverTransaction,
    values: typeof driver.$inferInsert,
  ): Promise<DriverRecord> {
    const [created] = await tx.insert(driver).values(values).returning();
    return created;
  }

  async insertDriverStats(
    tx: DriverTransaction,
    values: typeof driverStats.$inferInsert,
  ): Promise<void> {
    await tx.insert(driverStats).values(values);
  }

  async updateDriver(
    tx: DriverTransaction,
    userId: string,
    values: Partial<typeof driver.$inferInsert>,
  ): Promise<DriverRecord> {
    const [record] = await tx
      .update(driver)
      .set(values)
      .where(eq(driver.userId, userId))
      .returning();
    return record;
  }

  async updateDriverStandalone(
    userId: string,
    values: Partial<typeof driver.$inferInsert>,
  ): Promise<void> {
    await db.update(driver).set(values).where(eq(driver.userId, userId));
  }

  async deactivateDriver(
    tx: DriverTransaction,
    driverId: string,
  ): Promise<void> {
    const now = new Date();
    await tx
      .update(driver)
      .set({ isActive: false, deletedAt: now, updatedAt: now })
      .where(eq(driver.id, driverId));
  }

  async insertProfileImageUpload(
    tx: DriverTransaction,
    values: InsertDriverImage,
  ): Promise<{ id: string }> {
    const [upload] = await tx
      .insert(driverProfileImageUpload)
      .values(values)
      .returning({ id: driverProfileImageUpload.id });
    return upload;
  }
}
