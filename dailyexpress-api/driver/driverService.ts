import type { Driver, DriverStats, UpdateProfileRequest } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { DriverRepository } from "./driver.repository";
import { DriverProfileService } from "./driver-profile.service";
import { DriverStatsService } from "./driver-stats.service";
import type { DriverProfileImageUploadFile } from "./cloudinary";
import { db } from "../db/connection";
import { JobService } from "../workers/jobService";

type DriverMutationResult = Driver & {
  profilePictureUpload?: { id: string; status: "pending" };
};
type DriverTransaction = Parameters<Parameters<typeof import("../db/connection").db.transaction>[0]>[0];
type EarningStatus =
  | "pending_trip_completion"
  | "available"
  | "processing"
  | "paid"
  | "cancelled"
  | "manual_review";
type RouteStatus = "inactive" | "pending" | "active";

export class DriverService {
  private readonly repo: DriverRepository;
  private readonly profileService: DriverProfileService;
  private readonly statsService: DriverStatsService;
  private readonly jobService: JobService;

  constructor() {
    this.repo = new DriverRepository();
    this.profileService = new DriverProfileService(this.repo);
    this.statsService = new DriverStatsService();
    this.jobService = new JobService();
  }

  async createDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
    profileImageUpload?: DriverProfileImageUploadFile,
  ): Promise<DriverMutationResult> {
    return this.profileService.createDriver(userId, driverData, profileImageUpload);
  }

  async getProfile(userId: string): Promise<Driver | null> {
    return this.profileService.getProfile(userId);
  }

  async updateDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
    profileImageUpload?: DriverProfileImageUploadFile,
  ): Promise<DriverMutationResult> {
    return this.profileService.updateDriver(userId, driverData, profileImageUpload);
  }

  async deactivateDriver(userId: string): Promise<void> {
    const driverRecord = await this.repo.findDriverByUserId(userId);

    if (!driverRecord) {
      throw createServiceError("Driver not found", 404);
    }

    await db.transaction(async (tx) => {
      await this.jobService.enqueueDriverDeactivationRefund(tx, {
        driverId: driverRecord.id,
      });
      await this.repo.deactivateDriver(tx, driverRecord.id);
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

  async recordRouteStatusChange(
    tx: DriverTransaction,
    input: { driverId: string; previousStatus?: RouteStatus | null; nextStatus?: RouteStatus | null },
  ): Promise<void> {
    return this.statsService.recordRouteStatusChange(tx, input);
  }
}
