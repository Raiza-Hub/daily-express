import { createServiceError } from "@shared/utils";
import { db } from "../db/connection";
import { zone } from "../db/zone-schema";
import { eq } from "drizzle-orm";
import type { ZoneRecord } from "../db/zone-schema";

export class ZoneService {
  async getAllZones(): Promise<ZoneRecord[]> {
    return db.query.zone.findMany({
      orderBy: (zone, { asc }) => [asc(zone.name)],
    });
  }

  async getZoneById(id: string): Promise<ZoneRecord | null> {
    return (await db.query.zone.findFirst({
      where: eq(zone.id, id),
    })) ?? null;
  }

  async createZone(data: {
    name: string;
    fee: number;
  }): Promise<ZoneRecord> {
    const existingZone = await db.query.zone.findFirst({
      where: eq(zone.name, data.name),
    });

    if (existingZone) {
      throw createServiceError("Zone with this name already exists", 400);
    }

    const [newZone] = await db.insert(zone).values({
      name: data.name,
      fee: data.fee,
    }).returning();

    return newZone;
  }

  async updateZone(
    id: string,
    data: { name?: string; fee?: number },
  ): Promise<ZoneRecord> {
    const existingZone = await this.getZoneById(id);
    if (!existingZone) {
      throw createServiceError("Zone not found", 404);
    }

    if (data.name && data.name !== existingZone.name) {
      const duplicate = await db.query.zone.findFirst({
        where: eq(zone.name, data.name),
      });
      if (duplicate) {
        throw createServiceError("Zone with this name already exists", 400);
      }
    }

    const [updated] = await db
      .update(zone)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(zone.id, id))
      .returning();

    return updated;
  }

  async deleteZone(id: string): Promise<void> {
    const existingZone = await this.getZoneById(id);
    if (!existingZone) {
      throw createServiceError("Zone not found", 404);
    }

    await db.delete(zone).where(eq(zone.id, id));
  }
}

export const zoneService = new ZoneService();
