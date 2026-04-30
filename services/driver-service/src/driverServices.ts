import { Driver, DriverStats, UpdateProfileRequest } from "@shared/types";
import { db } from "../db/db";
import { driver, driverStats } from "../db/schema";
import { eq } from "drizzle-orm";
import { createServiceError, sanitizeInput } from "@shared/utils";
import {
  emitDriverBankVerificationRequested,
  emitDriverIdentityCreated,
  emitDriverIdentityDeleted,
  emitDriverIdentityUpdated,
  emitDriverPayoutProfileDeleted,
  emitDriverPayoutProfileUpserted,
} from "./kafka/producer";

export class DriverService {
  async createDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
  ): Promise<Driver> {
    //check if profile already exists
    const existingDriver = await db.query.driver.findFirst({
      where: eq(driver.userId, userId),
    });

    if (existingDriver) {
      throw createServiceError("Driver profile already exists", 400);
    }

    //sanitize input data
    const sanitizeData = this.sanitizeProfileData(driverData);

    const newDriver = await db.transaction(async (tx) => {
      const [createdDriver] = await tx
        .insert(driver)
        .values({
          ...sanitizeData,
          userId,
          bankVerificationStatus: "pending",
          bankVerificationFailureReason: null,
          bankVerificationRequestedAt: new Date(),
          bankVerifiedAt: null,
        } as any)
        .returning();

      await tx.insert(driverStats).values({
        driverId: createdDriver.id,
      });

      await emitDriverIdentityCreated(createdDriver, tx);
      await emitDriverPayoutProfileUpserted(createdDriver, tx);
      await emitDriverBankVerificationRequested(
        {
          driverId: createdDriver.id,
          bankName: createdDriver.bankName,
          bankCode: createdDriver.bankCode,
          accountNumber: createdDriver.accountNumber,
          accountName: createdDriver.accountName,
          currency: createdDriver.currency,
        },
        tx,
      );

      return createdDriver;
    });

    return newDriver;
  }

  async getProfile(userId: string): Promise<Driver | null> {
    //check if user exists
    const existingDriver = await db.query.driver.findFirst({
      where: eq(driver.userId, userId),
    });
    if (!existingDriver) {
      return null;
    }

    return existingDriver;
  }

  async getProfileById(id: string): Promise<Driver | null> {
    const existingDriver = await db.query.driver.findFirst({
      where: eq(driver.id, id),
    });
    if (!existingDriver) {
      return null;
    }

    return existingDriver;
  }

  async updateDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
  ): Promise<Driver> {
    //check if user exists
    const existingDriver = await db.query.driver.findFirst({
      where: eq(driver.userId, userId),
    });
    if (!existingDriver) {
      return this.createDriver(userId, driverData);
    }

    //sanitize input data
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

    const [updatedDriver] = await db.transaction(async (tx) => {
      const [record] = await tx
        .update(driver)
        .set({
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
        })
        .where(eq(driver.userId, userId))
        .returning();

      await emitDriverIdentityUpdated(record, tx);
      await emitDriverPayoutProfileUpserted(record, tx);
      if (bankDetailsChanged) {
        await emitDriverBankVerificationRequested(
          {
            driverId: record.id,
            bankName: record.bankName,
            bankCode: record.bankCode,
            accountNumber: record.accountNumber,
            accountName: record.accountName,
            currency: record.currency,
          },
          tx,
        );
      }

      return [record];
    });

    return updatedDriver;
  }

  async deleteDriver(userId: string): Promise<void> {
    //check if user exists
    const existingDriver = await db.query.driver.findFirst({
      where: eq(driver.userId, userId),
    });
    if (!existingDriver) {
      throw createServiceError("Driver not found", 404);
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(driverStats)
        .where(eq(driverStats.driverId, existingDriver.id));
      await tx.delete(driver).where(eq(driver.userId, userId));
      await emitDriverIdentityDeleted(
        {
          driverId: existingDriver.id,
          userId: existingDriver.userId,
        },
        tx,
      );
      await emitDriverPayoutProfileDeleted(
        {
          driverId: existingDriver.id,
          userId: existingDriver.userId,
        },
        tx,
      );
    });
  }

  async getDriverStats(driverId: string): Promise<DriverStats> {
    const stats = await db.query.driverStats.findFirst({
      where: eq(driverStats.driverId, driverId),
    });

    if (!stats) {
      throw createServiceError("Driver stats not found", 404);
    }

    return stats;
  }

  private sanitizeProfileData(
    data: Partial<UpdateProfileRequest>,
  ): Partial<UpdateProfileRequest> {
    const sanitized: any = {};

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
