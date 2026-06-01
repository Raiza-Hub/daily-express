import type { Driver, DriverStats, UpdateProfileRequest } from "@shared/types";
import { db } from "../db/connection";
import {
  driver,
  driverProfileImageUpload,
  driverStats,
} from "../db/index";
import { eq, sql, type SQL } from "drizzle-orm";
import { createServiceError, sanitizeInput } from "@shared/utils";
import { NotificationService } from "../notification/notificationService";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { jobService } from "../workers/jobService";
import { timeAsync } from "../utils/timing";

import type { DriverProfileImageUploadFile } from "./cloudinary";

type DriverTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DriverMutationResult = Driver & {
  profilePictureUpload?: {
    id: string;
    status: "pending";
  };
};

type EarningStatus =
  | "pending_trip_completion"
  | "available"
  | "processing"
  | "paid"
  | "cancelled"
  | "manual_review";

type RouteStatus = "inactive" | "pending" | "active";

const PENDING_PAYMENT_STATUSES = new Set<EarningStatus>([
  "pending_trip_completion",
  "available",
  "processing",
]);

const notificationService = new NotificationService();

export class DriverService {
  async createDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
    profileImageUpload?: DriverProfileImageUploadFile,
  ): Promise<DriverMutationResult> {
    // Check if profile already exists
    const existingDriver = await db.query.driver.findFirst({
      where: eq(driver.userId, userId),
    });

    if (existingDriver) {
      throw createServiceError("Driver profile already exists", 400);
    }

    // Sanitize input data
    const sanitizeData = this.sanitizeProfileData(driverData);
    if (profileImageUpload) {
      delete sanitizeData.profile_pic;
    }

    const result = await timeAsync(
      "driver.create.transaction",
      { userId },
      () =>
        db.transaction(async (tx) => {
          const [createdDriver] = await tx
            .insert(driver)
            .values({
              ...sanitizeData,
              userId,
              bankVerificationStatus: "pending",
              bankVerificationFailureReason: null,
              bankVerificationRequestedAt: new Date(),
              bankVerifiedAt: null,
            } as typeof driver.$inferInsert)
            .returning();

          await tx.insert(driverStats).values({
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
    // Check if user exists
    const existingDriver = await db.query.driver.findFirst({
      where: eq(driver.userId, userId),
    });

    if (!existingDriver) {
      return null;
    }

    return existingDriver;
  }

  async updateDriver(
    userId: string,
    driverData: Partial<UpdateProfileRequest>,
    profileImageUpload?: DriverProfileImageUploadFile,
  ): Promise<DriverMutationResult> {
    // Check if user exists
    const existingDriver = await db.query.driver.findFirst({
      where: eq(driver.userId, userId),
    });

    if (!existingDriver) {
      throw createServiceError("Driver not found", 404);
    }

    // Sanitize input data
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

  async deleteDriver(userId: string): Promise<void> {
    // Check if user exists
    const existingDriver = await db.query.driver.findFirst({
      where: eq(driver.userId, userId),
    });

    if (!existingDriver) {
      throw createServiceError("Driver not found", 404);
    }

    await db.transaction(async (tx) => {
      await this.deleteDriverRecords(tx, existingDriver);
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

  async deleteDriverForUser(
    tx: DriverTransaction,
    userId: string,
  ): Promise<void> {
    const existingDriver = await tx.query.driver.findFirst({
      where: eq(driver.userId, userId),
    });

    if (existingDriver) {
      await this.deleteDriverRecords(tx, existingDriver);
    }
  }

  async recordBookingConfirmed(
    tx: DriverTransaction,
    input: {
      driverId: string;
      fareAmountMinor: number;
    },
  ): Promise<void> {
    await tx
      .update(driverStats)
      .set({
        pendingPayments: sql`${driverStats.pendingPayments} + ${input.fareAmountMinor}`,
        totalPassengers: sql`${driverStats.totalPassengers} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, input.driverId));
  }

  async recordConfirmedBookingCancelled(
    tx: DriverTransaction,
    input: {
      driverId: string;
      amountMinor: number;
      previousEarningStatus?: EarningStatus | null;
    },
  ): Promise<void> {
    const pendingDelta =
      input.previousEarningStatus &&
      PENDING_PAYMENT_STATUSES.has(input.previousEarningStatus)
        ? input.amountMinor
        : 0;

    await tx
      .update(driverStats)
      .set({
        totalPassengers: sql`GREATEST(${driverStats.totalPassengers} - 1, 0)`,
        pendingPayments: sql`GREATEST(${driverStats.pendingPayments} - ${pendingDelta}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, input.driverId));
  }

  async recordPayoutCompleted(
    tx: DriverTransaction,
    input: {
      driverId: string;
      amountMinor: number;
    },
  ): Promise<void> {
    await tx
      .update(driverStats)
      .set({
        totalEarnings: sql`${driverStats.totalEarnings} + ${input.amountMinor}`,
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, input.driverId));
  }

  async recordEarningStatusChanged(
    tx: DriverTransaction,
    input: {
      driverId: string;
      amountMinor: number;
      previousStatus: EarningStatus;
      nextStatus: EarningStatus;
    },
  ): Promise<void> {
    const wasPendingPayment = PENDING_PAYMENT_STATUSES.has(input.previousStatus);
    const isPendingPayment = PENDING_PAYMENT_STATUSES.has(input.nextStatus);
    const wasInReview = input.previousStatus === "manual_review";
    const isInReview = input.nextStatus === "manual_review";

    if (wasPendingPayment === isPendingPayment && wasInReview === isInReview) {
      return;
    }

    const updates: Record<string, SQL | Date> = { updatedAt: new Date() };

    if (wasPendingPayment !== isPendingPayment) {
      updates.pendingPayments = wasPendingPayment
        ? sql`GREATEST(${driverStats.pendingPayments} - ${input.amountMinor}, 0)`
        : sql`${driverStats.pendingPayments} + ${input.amountMinor}`;
    }

    if (wasInReview !== isInReview) {
      updates.inReviewPayments = wasInReview
        ? sql`GREATEST(${driverStats.inReviewPayments} - ${input.amountMinor}, 0)`
        : sql`${driverStats.inReviewPayments} + ${input.amountMinor}`;
    }

    await tx
      .update(driverStats)
      .set(updates)
      .where(eq(driverStats.driverId, input.driverId));
  }

  async recordRouteStatusChanged(
    tx: DriverTransaction,
    input: {
      driverId: string;
      previousStatus?: RouteStatus | null;
      nextStatus?: RouteStatus | null;
    },
  ): Promise<void> {
    const wasActive = input.previousStatus === "active";
    const isActive = input.nextStatus === "active";
    if (wasActive === isActive) {
      return;
    }

    await tx
      .update(driverStats)
      .set({
        activeRoutes: isActive
          ? sql`${driverStats.activeRoutes} + 1`
          : sql`GREATEST(${driverStats.activeRoutes} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, input.driverId));
  }

  private async deleteDriverRecords(
    tx: DriverTransaction,
    existingDriver: Driver,
  ) {
    await tx
      .delete(driverStats)
      .where(eq(driverStats.driverId, existingDriver.id));
    await tx.delete(driver).where(eq(driver.userId, existingDriver.userId));
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

  private getBankVerificationJobData(record: Driver) {
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
    const [upload] = await tx
      .insert(driverProfileImageUpload)
      .values({
        driverId: input.driverId,
        userId: input.userId,
        fileName: input.file.fileName,
        mimeType: input.file.mimeType,
        size: input.file.size,
        fileBase64: input.file.fileBase64,
        oldProfilePictureUrl: input.oldProfilePictureUrl,
        metadata: {
          source: "driver-profile",
        },
      })
      .returning({ id: driverProfileImageUpload.id });

    await jobService.enqueueDriverProfileImageUpload(tx, {
      uploadId: upload.id,
    });

    return {
      id: upload.id,
      status: "pending" as const,
    };
  }

  private withProfilePictureUpload(
    record: Driver,
    profilePictureUpload: { id: string; status: "pending" } | null,
  ): DriverMutationResult {
    if (!profilePictureUpload) {
      return record;
    }

    return {
      ...record,
      profilePictureUpload,
    };
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
