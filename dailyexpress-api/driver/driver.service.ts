import type { Driver, UpdateProfileRequest } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { DriverRepository } from "./driver.repository";
import { DriverProfileService } from "./driver-profile.service";
import { db } from "../db/connection";
import { paymentRepository } from "../payment/payment.repository";
import { getStartOfTodayInRouteTimezone } from "../utils/timezone";

export class DriverService {
  private readonly repo: DriverRepository;
  private readonly profileService: DriverProfileService;

  constructor() {
    this.repo = new DriverRepository();
    this.profileService = new DriverProfileService(this.repo);
  }

  async createDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
  ): Promise<Driver> {
    return this.profileService.createDriver(userId, driverData);
  }

  async getProfile(userId: string): Promise<Driver | null> {
    return this.profileService.getProfile(userId);
  }

  async updateDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
    kycData?: { kycType: "bvn" | "nin"; kycId: string },
  ): Promise<Driver> {
    return this.profileService.updateDriver(userId, driverData, kycData);
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
}

export const driverService = new DriverService();
