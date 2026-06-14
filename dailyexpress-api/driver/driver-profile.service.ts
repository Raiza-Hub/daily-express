import type { Driver, DriverStats, UpdateProfileRequest } from "@shared/types";
import { db } from "../db/connection";
import { driver } from "../db/index";
import { createServiceError, sanitizeInput } from "@shared/utils";
import { NotificationService } from "../notification/notificationService";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { jobService } from "../workers/jobService";
import { timeAsync } from "../utils/timing";
import type { DriverProfileImageUploadFile } from "./cloudinary";
import { DriverRepository } from "./driver.repository";

type DriverTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DriverRecord = typeof driver.$inferSelect;

type DriverMutationResult = Driver & {
  profilePictureUpload?: { id: string; status: "pending" };
};

const notificationService = new NotificationService();

export class DriverProfileService {
  constructor(private repo: DriverRepository) {}

  async createDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
    profileImageUpload?: DriverProfileImageUploadFile,
  ): Promise<DriverMutationResult> {
    const existingDriver = await this.repo.findDriverByUserId(userId);
    if (existingDriver) {
      throw createServiceError("Driver profile already exists", 400);
    }

    const sanitizeData = this.sanitizeProfileData(driverData);
    if (profileImageUpload) {
      delete sanitizeData.profile_pic;
    }

    const result = await timeAsync(
      "driver.create.transaction",
      { userId },
      () =>
        db.transaction(async (tx) => {
          const createdDriver = await this.repo.insertDriver(tx, {
            ...sanitizeData,
            userId,
            bankVerificationStatus: "pending",
            bankVerificationFailureReason: null,
            bankVerificationRequestedAt: new Date(),
            bankVerifiedAt: null,
          } as typeof driver.$inferInsert);

          await this.repo.insertDriverStats(tx, {
            driverId: createdDriver.id,
          });

          const bankNotification =
            await notificationService.createBankVerificationStateInTransaction(
              tx,
              createdDriver.id,
              this.getBankVerificationPendingNotification(),
            );

          await timeAsync(
            "driver.create.bank_verification_enqueue",
            { driverId: createdDriver.id },
            () =>
              jobService.enqueueDriverBankVerification(
                tx,
                this.getBankVerificationJobData(createdDriver),
              ),
          );

          const profilePictureUpload = profileImageUpload
            ? await this.enqueueProfileImageUpload(tx, {
                driverId: createdDriver.id,
                userId,
                oldProfilePictureUrl: null,
                file: profileImageUpload,
              })
            : null;

          return {
            driver: createdDriver,
            bankNotification,
            profilePictureUpload,
          };
        }),
    );

    if (
      result.bankNotification.notification &&
      result.bankNotification.shouldDeliver
    ) {
      publishNotificationCreatedInBackground(
        result.bankNotification.notification,
      );
    }

    return this.withProfilePictureUpload(
      result.driver,
      result.profilePictureUpload,
    );
  }

  async getProfile(userId: string): Promise<Driver | null> {
    const existingDriver = await this.repo.findDriverByUserId(userId);
    return existingDriver ?? null;
  }

  async updateDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
    profileImageUpload?: DriverProfileImageUploadFile,
  ): Promise<DriverMutationResult> {
    const existingDriver = await this.repo.findDriverByUserId(userId);
    if (!existingDriver) {
      throw createServiceError("Driver not found", 404);
    }

    const sanitizedData = this.sanitizeProfileData(driverData);
    if (profileImageUpload) {
      delete sanitizedData.profile_pic;
    }

    const bankDetailsChanged =
      (sanitizedData.bankName !== undefined &&
        sanitizedData.bankName !== existingDriver.bankName) ||
      (sanitizedData.bankCode !== undefined &&
        sanitizedData.bankCode !== existingDriver.bankCode) ||
      (sanitizedData.accountNumber !== undefined &&
        sanitizedData.accountNumber !== existingDriver.accountNumber) ||
      (sanitizedData.accountName !== undefined &&
        sanitizedData.accountName !== existingDriver.accountName);

    const result = await db.transaction(async (tx) => {
      const record = await this.repo.updateDriver(tx, userId, {
        ...sanitizedData,
        ...(bankDetailsChanged
          ? {
              bankVerificationStatus: "pending" as const,
              bankVerificationFailureReason: null,
              bankVerificationRequestedAt: new Date(),
              bankVerifiedAt: null,
            }
          : {}),
        updatedAt: new Date(),
      });

      let bankNotification: Awaited<
        ReturnType<
          typeof notificationService.createBankVerificationStateInTransaction
        >
      > | null = null;
      if (bankDetailsChanged) {
        bankNotification =
          await notificationService.createBankVerificationStateInTransaction(
            tx,
            record.id,
            this.getBankVerificationPendingNotification(),
          );

        await jobService.enqueueDriverBankVerification(
          tx,
          this.getBankVerificationJobData(record),
        );
      }

      const profilePictureUpload = profileImageUpload
        ? await this.enqueueProfileImageUpload(tx, {
            driverId: record.id,
            userId,
            oldProfilePictureUrl: existingDriver.profile_pic ?? null,
            file: profileImageUpload,
          })
        : null;

      return { driver: record, bankNotification, profilePictureUpload };
    });

    if (
      result.bankNotification?.notification &&
      result.bankNotification.shouldDeliver
    ) {
      publishNotificationCreatedInBackground(
        result.bankNotification.notification,
      );
    }

    return this.withProfilePictureUpload(
      result.driver,
      result.profilePictureUpload,
    );
  }

  async deactivateDriver(userId: string): Promise<void> {
    const existingDriver = await this.repo.findDriverByUserId(userId);
    if (!existingDriver) {
      throw createServiceError("Driver not found", 404);
    }

    await this.repo.updateDriverStandalone(userId, {
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async getDriverStats(driverId: string): Promise<DriverStats> {
    const stats = await this.repo.findDriverStatsByDriverId(driverId);
    if (!stats) {
      throw createServiceError("Driver stats not found", 404);
    }
    return stats;
  }

  private getBankVerificationPendingNotification() {
    return {
      notificationKey: "bank-verification-pending",
      kind: "state" as const,
      type: "bank_verification_pending",
      title: "Bank verification in progress",
      message:
        "We are still verifying your payout account. Automatic payouts stay on hold until verification finishes.",
      href: "/settings/bank-details",
      tag: "Verification",
      tone: "attention" as const,
      occurredAt: new Date(),
    };
  }

  private getBankVerificationJobData(record: DriverRecord) {
    return {
      driverId: record.id,
      bankName: record.bankName,
      bankCode: record.bankCode,
      accountNumber: record.accountNumber,
      accountName: record.accountName,
      currency: record.currency,
    };
  }

  private async enqueueProfileImageUpload(
    tx: DriverTransaction,
    input: {
      driverId: string;
      userId: string;
      oldProfilePictureUrl: string | null;
      file: DriverProfileImageUploadFile;
    },
  ) {
    const upload = await this.repo.insertProfileImageUpload(tx, {
      driverId: input.driverId,
      userId: input.userId,
      fileName: input.file.fileName,
      mimeType: input.file.mimeType,
      size: input.file.size,
      fileBase64: input.file.fileBase64,
      oldProfilePictureUrl: input.oldProfilePictureUrl,
      metadata: { source: "driver-profile" },
    });

    await jobService.enqueueDriverProfileImageUpload(tx, {
      uploadId: upload.id,
    });

    return { id: upload.id, status: "pending" as const };
  }

  private withProfilePictureUpload(
    record: Driver,
    profilePictureUpload: { id: string; status: "pending" } | null,
  ): DriverMutationResult {
    if (!profilePictureUpload) return record;
    return { ...record, profilePictureUpload };
  }

  private sanitizeProfileData(
    data: Partial<UpdateProfileRequest>,
  ): Partial<UpdateProfileRequest> {
    const sanitized: Record<string, string | null> = {};

    if (data.firstName !== undefined) {
      sanitized.firstName = data.firstName
        ? sanitizeInput(data.firstName)
        : null;
    }
    if (data.lastName !== undefined) {
      sanitized.lastName = data.lastName ? sanitizeInput(data.lastName) : null;
    }
    if (data.email !== undefined) {
      sanitized.email = data.email ? sanitizeInput(data.email) : null;
    }
    if (data.country !== undefined) {
      sanitized.country = data.country ? sanitizeInput(data.country) : null;
    }
    if (data.currency !== undefined) {
      sanitized.currency = data.currency ? sanitizeInput(data.currency) : null;
    }
    if (data.state !== undefined) {
      sanitized.state = data.state ? sanitizeInput(data.state) : null;
    }
    if (data.city !== undefined) {
      sanitized.city = data.city ? sanitizeInput(data.city) : null;
    }
    if (data.address !== undefined) {
      sanitized.address = data.address ? sanitizeInput(data.address) : null;
    }
    if (data.bankName !== undefined) {
      sanitized.bankName = data.bankName ? sanitizeInput(data.bankName) : null;
    }
    if (data.bankCode !== undefined) {
      sanitized.bankCode = data.bankCode ? sanitizeInput(data.bankCode) : null;
    }
    if (data.accountNumber !== undefined) {
      sanitized.accountNumber = data.accountNumber
        ? sanitizeInput(data.accountNumber)
        : null;
    }
    if (data.accountName !== undefined) {
      sanitized.accountName = data.accountName
        ? sanitizeInput(data.accountName)
        : null;
    }
    if (data.profile_pic !== undefined) {
      sanitized.profile_pic = data.profile_pic
        ? sanitizeInput(data.profile_pic)
        : null;
    }
    if (data.phone !== undefined) {
      sanitized.phone = data.phone ? sanitizeInput(data.phone) : null;
    }

    return sanitized;
  }
}
