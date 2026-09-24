import { and, eq, inArray, ne, notInArray } from "drizzle-orm";
import { db } from "../db/connection";
import { driver, trip, type DriverRecord } from "../db/index";
import type { DbTransaction } from "../db/connection";

type DriverTransaction = DbTransaction;

export class DriverRepository {
  async findDriverByUserId(userId: string): Promise<DriverRecord | null> {
    return (await db.query.driver.findFirst({ where: eq(driver.userId, userId) })) ?? null;
  }

  async findDriverByKycId(kycId: string, excludeDriverId?: string): Promise<DriverRecord | null> {
    const conditions = [eq(driver.kycId, kycId), inArray(driver.kycStatus, ["active"])];
    if (excludeDriverId) {
      conditions.push(ne(driver.id, excludeDriverId));
    }
    return (await db.query.driver.findFirst({ where: and(...conditions) })) ?? null;
  }

  async insertDriver(
    tx: DriverTransaction,
    values: typeof driver.$inferInsert,
  ): Promise<DriverRecord> {
    const [created] = await tx.insert(driver).values(values).returning();
    return created;
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

  async findNonCompletedTripByDriverId(driverId: string) {
    const result = await db.query.trip.findFirst({
      where: and(
        eq(trip.driverId, driverId),
        notInArray(trip.status, ["cancelled", "completed"]),
      ),
      columns: { id: true },
    });
    return result ?? null;
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
}

export const driverRepository = new DriverRepository();
