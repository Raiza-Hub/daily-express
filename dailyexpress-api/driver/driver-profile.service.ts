import { createHash } from "node:crypto";
import type { Driver, UpdateProfileRequest } from "@shared/types";
import { db } from "../db/connection";
import { driver } from "../db/index";
import { createServiceError, sanitizeInput } from "@shared/utils";
import { koraClient } from "../payment/kora.client";
import { koraIdentityClient } from "../kyc/kora-identity.client";
import { timeAsync } from "../utils/timing";
import { DriverRepository, driverRepository } from "./driver.repository";

export class DriverProfileService {
  constructor(private repo: DriverRepository) {}

  async createDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
  ): Promise<Driver> {
    const existingDriver = await this.repo.findDriverByUserId(userId);
    if (existingDriver) {
      throw createServiceError("Driver profile already exists", 400);
    }

    try {
      const sanitizeData = this.sanitizeProfileData(driverData);

      const result = await timeAsync(
        "driver.create.transaction",
        { userId },
        () =>
          db.transaction(async (tx) => {
            const createdDriver = await this.repo.insertDriver(tx, {
              ...sanitizeData,
              userId,
              bankVerificationStatus: null,
              kycStatus: null,
              kycType: null,
              kycId: null,
            } as typeof driver.$inferInsert);

            return {
              driver: createdDriver,
            };
          }),
      );

      return result.driver;
    } catch (error) {
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
    kycData?: { kycType: "bvn" | "nin"; kycId: string },
  ): Promise<Driver> {
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

      const existing = await this.repo.findDriverByKycId(hashKycId(kycData.kycId), existingDriver.id);
      if (existing) {
        throw createServiceError(
          "This identity document has already been verified with another driver account",
          409,
        );
      }
    }

    const sanitizedData = this.sanitizeProfileData(driverData);

    const bankDetailsChanged =
      (sanitizedData.bankName !== undefined &&
        sanitizedData.bankName !== existingDriver.bankName) ||
      (sanitizedData.bankCode !== undefined &&
        sanitizedData.bankCode !== existingDriver.bankCode) ||
      (sanitizedData.accountNumber !== undefined &&
        sanitizedData.accountNumber !== existingDriver.accountNumber) ||
      (sanitizedData.accountName !== undefined &&
        sanitizedData.accountName !== existingDriver.accountName);

    const record = await db.transaction(async (tx) =>
      this.repo.updateDriver(tx, userId, {
        ...sanitizedData,
        updatedAt: new Date(),
      }),
    );

    if (bankDetailsChanged) {
      await this.verifyBankDetails(userId);
    }

    if (kycData) {
      await this.verifyKyc(userId, kycData);
    }

    const updatedDriver = await this.repo.findDriverByUserId(userId);
    return updatedDriver ?? record;
  }

  private async verifyBankDetails(userId: string): Promise<void> {
    const record = await this.repo.findDriverByUserId(userId);
    if (!record) {
      throw createServiceError("Driver not found", 404);
    }

    if (!record.bankCode || !record.accountNumber) {
      throw createServiceError(
        "Bank code and account number are required",
        400,
      );
    }

    try {
      const resolved = await koraClient.resolveAccountNumber(
        record.bankCode,
        record.accountNumber,
        record.currency,
      );

      await db.transaction(async (tx) =>
        this.repo.updateDriver(tx, userId, {
          bankName: resolved.data.bank_name,
          bankCode: resolved.data.bank_code,
          accountNumber: resolved.data.account_number,
          accountName: resolved.data.account_name,
          bankVerificationStatus: "active",
          updatedAt: new Date(),
        }),
      );
    } catch (error) {
      await db.transaction(async (tx) =>
        this.repo.updateDriver(tx, userId, {
          bankVerificationStatus: "failed",
          updatedAt: new Date(),
        }),
      );
      throw error;
    }
  }

  private async verifyKyc(
    userId: string,
    kycData: { kycType: "bvn" | "nin"; kycId: string },
  ): Promise<void> {
    try {
      const verified =
        kycData.kycType === "bvn"
          ? await koraIdentityClient.verifyBVN(kycData.kycId)
          : await koraIdentityClient.verifyNIN(kycData.kycId);

      await db.transaction(async (tx) =>
        this.repo.updateDriver(tx, userId, {
          kycStatus: "active",
          kycType: kycData.kycType,
          kycId: hashKycId(kycData.kycId),
          kycVerificationReference: verified.reference,
          updatedAt: new Date(),
        }),
      );
    } catch (error) {
      await db.transaction(async (tx) =>
        this.repo.updateDriver(tx, userId, {
          kycStatus: "failed",
          updatedAt: new Date(),
        }),
      );
      throw error;
    }
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

function hashKycId(kycId: string): string {
  return createHash("sha256").update(kycId).digest("hex");
}

export const driverProfileService = new DriverProfileService(driverRepository);
