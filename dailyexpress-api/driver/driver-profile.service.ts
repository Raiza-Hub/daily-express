import type { Driver, DriverStats, UpdateProfileRequest } from "@shared/types";
import { db } from "../db/connection";
import { driver } from "../db/index";
import { createServiceError, sanitizeInput } from "@shared/utils";
import { notificationService } from "../notification/notification.service";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { jobService } from "../workers/job.service";
import { kycDedupClient } from "../kyc/kyc-dedup.client";
import { timeAsync } from "../utils/timing";
import type { DriverProfileImageUploadFile } from "./cloudinary";
import { DriverRepository, driverRepository } from "./driver.repository";

import type { DbTransaction } from "../db/connection";
import type { DriverRecord } from "../db/index";
type DriverTransaction = DbTransaction;

type DriverMutationResult = Driver & {
  profilePictureUpload?: { id: string; status: "pending" };
};

export class DriverProfileService {
  constructor(private repo: DriverRepository) {}

  async createDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
    profileImageUpload?: DriverProfileImageUploadFile,
    kycData?: { kycType: "bvn" | "nin"; kycId: string },
  ): Promise<DriverMutationResult> {
    const existingDriver = await this.repo.findDriverByUserId(userId);
    if (existingDriver) {
      throw createServiceError("Driver profile already exists", 400);
    }

    if (kycData) {
      const dupCheck = await kycDedupClient.checkDuplicate(kycData.kycId, null, kycData.kycType);
      if (dupCheck.isDuplicate) {
        throw createServiceError(
          "This identity document has already been verified with another driver account",
          409,
        );
      }
    }

    try {
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
              kycStatus: kycData ? "pending" : "none",
              kycType: kycData?.kycType ?? null,
              kycRequestedAt: kycData ? new Date() : null,
              kycFailureReason: null,
              kycVerifiedAt: null,
            } as typeof driver.$inferInsert);

            await this.repo.insertDriverStats(tx, {
              driverId: createdDriver.id,
            });

            const bankNotification =
              await notificationService.createBankVerificationStateInTransaction(
                tx,
                createdDriver.id,
                this.getAccountSetupPendingNotification(),
              );

            await jobService.enqueueDriverVerification(
              tx,
              {
                type: "bank_verification",
                driverId: createdDriver.id,
                bankName: createdDriver.bankName,
                bankCode: createdDriver.bankCode,
                accountNumber: createdDriver.accountNumber,
                accountName: createdDriver.accountName,
                currency: createdDriver.currency,
              },
            );

            if (kycData) {
              await jobService.enqueueDriverVerification(
                tx,
                {
                  type: "kyc_verification",
                  driverId: createdDriver.id,
                  kycType: kycData.kycType,
                  kycId: kycData.kycId,
                  firstName: sanitizeData.firstName ?? undefined,
                  lastName: sanitizeData.lastName ?? undefined,
                },
              );
            }

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
    } catch (error) {
      if (kycData) {
        await kycDedupClient.releaseClaim(kycData.kycId).catch(() => {});
      }
      throw error;
    }
  }

  async getProfile(userId: string): Promise<Driver | null> {
    const existingDriver = await this.repo.findDriverByUserId(userId);
    return existingDriver ?? null;
  }

  async updateDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
    profileImageUpload?: DriverProfileImageUploadFile,
    kycData?: { kycType: "bvn" | "nin"; kycId: string },
  ): Promise<DriverMutationResult> {
    const existingDriver = await this.repo.findDriverByUserId(userId);
    if (!existingDriver) {
      throw createServiceError("Driver not found", 404);
    }

    if (kycData) {
      if (existingDriver.kycStatus === "active") {
        throw createServiceError(
          "Your identity has already been verified and cannot be changed",
          400,
        );
      }
      if (existingDriver.kycStatus === "pending") {
        throw createServiceError(
          "Identity verification is already in progress",
          409,
        );
      }

      const dupCheck = await kycDedupClient.checkDuplicate(
        kycData.kycId,
        existingDriver.id,
        kycData.kycType,
      );
      if (dupCheck.isDuplicate) {
        throw createServiceError(
          "This identity document has already been verified with another driver account",
          409,
        );
      }
    }

    try {
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
          ...(kycData
            ? {
                kycStatus: "pending" as const,
                kycType: kycData.kycType,
                kycRequestedAt: new Date(),
                kycFailureReason: null,
                kycVerifiedAt: null,
                kycVerificationReference: null,
              }
            : {}),
          updatedAt: new Date(),
        });

        let bankNotification: Awaited<
          ReturnType<
            typeof notificationService.createBankVerificationStateInTransaction
          >
        > | null = null;
        let kycNotification: Awaited<
          ReturnType<
            typeof notificationService.createKycVerificationStateInTransaction
          >
        > | null = null;
        if (bankDetailsChanged) {
          bankNotification =
            await notificationService.createBankVerificationStateInTransaction(
              tx,
              record.id,
              this.getBankVerificationPendingNotification(),
            );

          await jobService.enqueueDriverVerification(
            tx,
            {
              type: "bank_verification",
              driverId: record.id,
              bankName: record.bankName,
              bankCode: record.bankCode,
              accountNumber: record.accountNumber,
              accountName: record.accountName,
              currency: record.currency,
            },
          );
        }

        if (kycData) {
          kycNotification =
            await notificationService.createKycVerificationStateInTransaction(
              tx,
              record.id,
              this.getKycVerificationPendingNotification(),
            );

          await jobService.enqueueDriverVerification(
            tx,
            {
              type: "kyc_verification",
              driverId: record.id,
              kycType: kycData.kycType,
              kycId: kycData.kycId,
              firstName: record.firstName ?? undefined,
              lastName: record.lastName ?? undefined,
            },
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

        return { driver: record, bankNotification, kycNotification, profilePictureUpload };
      });

      if (
        result.bankNotification?.notification &&
        result.bankNotification.shouldDeliver
      ) {
        publishNotificationCreatedInBackground(
          result.bankNotification.notification,
        );
      }

      if (
        result.kycNotification?.notification &&
        result.kycNotification.shouldDeliver
      ) {
        publishNotificationCreatedInBackground(
          result.kycNotification.notification,
        );
      }

      return this.withProfilePictureUpload(
        result.driver,
        result.profilePictureUpload,
      );
    } catch (error) {
      if (kycData) {
        await kycDedupClient.releaseClaim(kycData.kycId).catch(() => {});
      }
      throw error;
    }
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

  private getAccountSetupPendingNotification() {
    return {
      notificationKey: "account-setup-pending",
      kind: "state" as const,
      type: "account_setup_pending",
      title: "Setting up your account",
      message:
        "We're verifying your bank and identity details. You'll be notified once everything is ready.",
      href: "/settings/bank-details",
      tag: "Verification",
      tone: "attention" as const,
      occurredAt: new Date(),
    };
  }

  private getBankVerificationPendingNotification() {
    return {
      notificationKey: "bank-verification-pending",
      kind: "state" as const,
      type: "bank_verification_pending",
      title: "Bank verification in progress",
      message:
        "We are still verifying your payout account. Payouts stay on hold until verification finishes.",
      href: "/settings/bank-details",
      tag: "Verification",
      tone: "attention" as const,
      occurredAt: new Date(),
    };
  }

  private getKycVerificationPendingNotification() {
    return {
      notificationKey: "kyc-verification-pending",
      kind: "state" as const,
      type: "kyc_verification_pending",
      title: "Identity verification in progress",
      message: "We're verifying your identity. You'll be notified once it's complete.",
      href: "/settings/bank-details",
      tag: "Verification",
      tone: "attention" as const,
      occurredAt: new Date(),
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

export const driverProfileService = new DriverProfileService(driverRepository);
