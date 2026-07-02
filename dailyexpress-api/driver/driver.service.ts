import type { Driver, DriverStats, UpdateProfileRequest } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "../db/connection";
import { driver, trip } from "../db/index";
import { driverRepository } from "./driver.repository";
import { driverProfileService } from "./driver-profile.service";
import { driverStatsService } from "./driver-stats.service";
import type { DriverProfileImageUploadFile } from "./cloudinary";

type DriverMutationResult = Driver & {
  profilePictureUpload?: { id: string; status: "pending" };
};
import type { DbTransaction } from "../db/connection";
type DriverTransaction = DbTransaction;
type EarningStatus =
  | "pending_trip_completion"
  | "available"
  | "processing"
  | "paid"
  | "cancelled"
  | "manual_review";
export class DriverService {
  constructor(
    private repo = driverRepository,
    private profileService = driverProfileService,
    private statsService = driverStatsService,
  ) {}

  async createDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
    profileImageUpload?: DriverProfileImageUploadFile,
    kycData?: { kycType: "bvn" | "nin"; kycId: string },
  ): Promise<DriverMutationResult> {
    return this.profileService.createDriver(userId, driverData, profileImageUpload, kycData);
  }

  async getProfile(userId: string): Promise<Driver | null> {
    return this.profileService.getProfile(userId);
  }

  async updateDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
    profileImageUpload?: DriverProfileImageUploadFile,
    kycData?: { kycType: "bvn" | "nin"; kycId: string },
  ): Promise<DriverMutationResult> {
    return this.profileService.updateDriver(userId, driverData, profileImageUpload, kycData);
  }

  async deactivateDriver(userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Lock and retrieve the driver record FOR UPDATE
      const [lockedDriver] = await tx
        .select()
        .from(driver)
        .where(eq(driver.userId, userId))
        .for("update");

      if (!lockedDriver) {
        throw createServiceError("Driver not found", 404);
      }

      // 2. Query active trips within the locked transaction
      const activeTrip = await tx.query.trip.findFirst({
        where: and(
          eq(trip.driverId, lockedDriver.id),
          notInArray(trip.status, ["cancelled", "completed"]),
        ),
        columns: { id: true },
      });

      if (activeTrip) {
        throw createServiceError(
          "You have active trips. Complete them before deactivating.",
          400,
        );
      }

      // 3. Mark the driver as inactive
      const now = new Date();
      await tx
        .update(driver)
        .set({
          isActive: false,
          deletedAt: now,
          updatedAt: now,
        })
        .where(eq(driver.id, lockedDriver.id));
    });
  }

  async getDriverStats(driverId: string): Promise<DriverStats> {
    return this.profileService.getDriverStats(driverId);
  }

  async recordNewBookingForDriver(
    tx: DriverTransaction,
    input: { driverId: string; fareAmountMinor: number },
  ): Promise<void> {
    return this.statsService.recordNewBookingForDriver(tx, input);
  }

  async decrementStatsForCancelledBooking(
    tx: DriverTransaction,
    input: { driverId: string; amountMinor: number; previousEarningStatus?: EarningStatus | null },
  ): Promise<void> {
    return this.statsService.decrementStatsForCancelledBooking(tx, input);
  }

  async recordPayoutForDriver(
    tx: DriverTransaction,
    input: { driverId: string; amountMinor: number },
  ): Promise<void> {
    return this.statsService.recordPayoutForDriver(tx, input);
  }

  async adjustPaymentCountersForStatusChange(
    tx: DriverTransaction,
    input: { driverId: string; amountMinor: number; previousStatus: EarningStatus; nextStatus: EarningStatus },
  ): Promise<void> {
    return this.statsService.adjustPaymentCountersForStatusChange(tx, input);
  }
}

export const driverService = new DriverService();
