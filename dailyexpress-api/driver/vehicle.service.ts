import { createServiceError } from "@shared/utils";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "../db/connection";
import { driver, trip, vehicle } from "../db/index";
import { logger } from "../utils/logger";
import { DriverRepository, driverRepository } from "./driver.repository";

type VehicleRecord = Awaited<ReturnType<DriverRepository["findVehicleById"]>>;

type CreateVehicleInput = {
  plateNumber: string;
  make: string;
  model: string;
  capacity: number;
  color: string;
};

export class VehicleService {
  constructor(private repo: DriverRepository) {}

  async createVehicle(driverId: string, data: CreateVehicleInput) {
    const created = await db.transaction(async (tx) => {
      const [lockedDriver] = await tx
        .select()
        .from(driver)
        .where(eq(driver.id, driverId))
        .for("update");

      if (!lockedDriver) {
        throw createServiceError("Driver not found", 404);
      }
      if (!lockedDriver.isActive) {
        throw createServiceError("Driver account is deactivated", 403);
      }
      if (lockedDriver.bankVerificationStatus !== "active") {
        throw createServiceError("Driver bank account must be verified before registering vehicles", 403);
      }

      const vehicleRecord = await this.repo.insertVehicle(tx, {
        driverId,
        plateNumber: data.plateNumber,
        make: data.make,
        model: data.model,
        capacity: data.capacity,
        color: data.color,
      });
      return vehicleRecord;
    });

    logger.info("vehicle.created", { driverId, plateNumber: data.plateNumber });
    return created;
  }

  async getVehicles(driverId: string) {
    const vehicles = await this.repo.findVehiclesByDriverId(driverId);
    return vehicles.map((v) => ({
      id: v.id,
      plateNumber: v.plateNumber,
      make: v.make,
      model: v.model,
      capacity: v.capacity,
      color: v.color,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));
  }

  async updateVehicle(
    driverId: string,
    vehicleId: string,
    data: Partial<CreateVehicleInput>,
  ) {
    const updated = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(vehicle)
        .where(eq(vehicle.id, vehicleId))
        .for("update");

      if (!locked) {
        throw createServiceError("Vehicle not found", 404);
      }
      if (locked.driverId !== driverId) {
        throw createServiceError("Unauthorized", 403);
      }
      const activeTrip = await tx.query.trip.findFirst({
        where: and(
          eq(trip.vehicleId, vehicleId),
          notInArray(trip.status, ["completed", "cancelled"]),
        ),
        columns: { id: true },
      });
      if (activeTrip) {
        throw createServiceError(
          "Cannot update a vehicle that has active trips",
          400,
        );
      }

      const result = await this.repo.updateVehicle(tx, vehicleId, data);
      if (!result) {
        throw createServiceError("Failed to update vehicle", 500);
      }
      return result;
    });

    logger.info("vehicle.updated", { vehicleId, driverId });
    return updated;
  }

  async deleteVehicle(driverId: string, vehicleId: string) {
    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(vehicle)
        .where(eq(vehicle.id, vehicleId))
        .for("update");

      if (!locked) {
        throw createServiceError("Vehicle not found", 404);
      }
      if (locked.driverId !== driverId) {
        throw createServiceError("Unauthorized", 403);
      }
      const activeTrip = await tx.query.trip.findFirst({
        where: and(
          eq(trip.vehicleId, vehicleId),
          notInArray(trip.status, ["completed", "cancelled"]),
        ),
        columns: { id: true },
      });
      if (activeTrip) {
        throw createServiceError(
          "Cannot delete a vehicle that has active trips",
          400,
        );
      }

      await this.repo.deleteVehicle(tx, vehicleId);
    });

    logger.info("vehicle.deleted", { vehicleId, driverId });
  }
}

export const vehicleService = new VehicleService(driverRepository);
