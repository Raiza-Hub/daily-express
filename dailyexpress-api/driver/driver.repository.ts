import { and, desc, eq, inArray, ne, notInArray } from "drizzle-orm";
import { db } from "../db/connection";
import { driver, driverStats, trip, vehicle, type DriverRecord, type DriverStatsRecord, type VehicleRecord } from "../db/index";
import type { DbTransaction } from "../db/connection";

type DriverTransaction = DbTransaction;
type VehicleInsert = typeof vehicle.$inferInsert;

export class DriverRepository {
  async findDriverByUserId(userId: string): Promise<DriverRecord | null> {
    return (await db.query.driver.findFirst({ where: eq(driver.userId, userId) })) ?? null;
  }

  async findDriverByKycId(kycId: string, excludeDriverId?: string): Promise<DriverRecord | null> {
    const conditions = [eq(driver.kycId, kycId), inArray(driver.kycStatus, ["active", "pending"])];
    if (excludeDriverId) {
      conditions.push(ne(driver.id, excludeDriverId));
    }
    return (await db.query.driver.findFirst({ where: and(...conditions) })) ?? null;
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

  // --- Vehicle ---

  async findVehiclesByDriverId(driverId: string): Promise<VehicleRecord[]> {
    return db.query.vehicle.findMany({
      where: eq(vehicle.driverId, driverId),
      orderBy: [desc(vehicle.createdAt)],
    });
  }

  async findVehicleById(id: string): Promise<VehicleRecord | null> {
    return (await db.query.vehicle.findFirst({ where: eq(vehicle.id, id) })) ?? null;
  }

  async insertVehicle(
    tx: DriverTransaction,
    data: VehicleInsert,
  ): Promise<VehicleRecord> {
    const [record] = await tx.insert(vehicle).values(data).returning();
    return record;
  }

  async updateVehicle(
    tx: DriverTransaction,
    id: string,
    data: Partial<VehicleInsert>,
  ): Promise<VehicleRecord | null> {
    const [record] = await tx
      .update(vehicle)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vehicle.id, id))
      .returning();
    return record ?? null;
  }

  async deleteVehicle(tx: DriverTransaction, id: string): Promise<void> {
    await tx.delete(vehicle).where(eq(vehicle.id, id));
  }

}

export const driverRepository = new DriverRepository();
