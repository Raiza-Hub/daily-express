import type { Driver, DriverStats, UpdateProfileRequest } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { DriverRepository } from "./driver.repository";
import { DriverProfileService } from "./driver-profile.service";
import { DriverStatsService } from "./driver-stats.service";
import type { DriverProfileImageUploadFile } from "./cloudinary";
import { db } from "../db/connection";
import { paymentRepository } from "../payment/payment.repository";
import { getStartOfTodayInRouteTimezone } from "../utils/timezone";

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

export class DriverService {
  private readonly repo: DriverRepository;
  private readonly profileService: DriverProfileService;
  private readonly statsService: DriverStatsService;

  constructor() {
    this.repo = new DriverRepository();
    this.profileService = new DriverProfileService(this.repo);
    this.statsService = new DriverStatsService();
  }

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
    const driverRecord = await this.repo.findDriverByUserId(userId);

    if (!driverRecord) {
      throw createServiceError("Driver not found", 404);
    }

    const upcomingTrips = await paymentRepository.findSuccessfulPaymentsForDriverUpcomingTrips(
      driverRecord.id,
      getStartOfTodayInRouteTimezone(),
    );
    if (upcomingTrips.length > 0) {
      throw createServiceError(
        "Cannot deactivate your account. You have upcoming trips with confirmed bookings.",
        400,
      );
    }

    await db.transaction(async (tx) => {
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

}

export const driverService = new DriverService();
