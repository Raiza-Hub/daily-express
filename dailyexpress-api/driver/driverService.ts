import type { Driver, DriverStats, UpdateProfileRequest } from "@shared/types";
import { db } from "../db/connection";
import {
  driver,
  driverProfileImageUpload,
  driverStats,
  earning,
  payout,
  route,
} from "../db/index";
import { and, eq, sql } from "drizzle-orm";
import { createServiceError, sanitizeInput } from "@shared/utils";
import { NotificationService } from "../notification/notificationService";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { jobService } from "../workers/jobService";
import { timeAsync } from "../utils/timing";
import { addDaysToDateKey } from "../utils/route";
import { formatDateKey } from "../utils/timezone";
import type { DriverProfileImageUploadFile } from "./cloudinary";

type DriverTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DriverMutationResult = Driver & {
  profilePictureUpload?: {
    id: string;
    status: "pending";
  };
};

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
            } as any)
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

    const payoutTotals = db
      .select({
        driverId: payout.driverId,
        totalEarnings: sql<number>`sum(${payout.amountMinor})::bigint`
          .mapWith(Number)
          .as("total_earnings"),
      })
      .from(payout)
      .where(and(eq(payout.driverId, driverId), eq(payout.status, "success")))
      .groupBy(payout.driverId)
      .as("payout_totals");

    const earningTotals = db
      .select({
        driverId: earning.driverId,
        totalPassengers:
          sql<number>`count(*) filter (where ${earning.status} in ('pending_trip_completion', 'available', 'reserved', 'processing', 'paid'))::int`.as(
            "total_passengers",
          ),
        pendingPayments:
          sql<number>`sum(${earning.netAmountMinor}) filter (where ${earning.status} in ('pending_trip_completion', 'available', 'reserved', 'processing'))::bigint`
            .mapWith(Number)
            .as("pending_payments"),
      })
      .from(earning)
      .where(eq(earning.driverId, driverId))
      .groupBy(earning.driverId)
      .as("earning_totals");

    const routeTotals = db
      .select({
        driverId: route.driverId,
        activeRoutes: sql<number>`count(*)::int`.as("active_routes"),
      })
      .from(route)
      .where(and(eq(route.driverId, driverId), eq(route.status, "active")))
      .groupBy(route.driverId)
      .as("route_totals");

    const [totals] = await db
      .select({
        totalEarnings:
          sql<number>`coalesce(${payoutTotals.totalEarnings}, 0)`.mapWith(
            Number,
          ),
        pendingPayments:
          sql<number>`coalesce(${earningTotals.pendingPayments}, 0)`.mapWith(
            Number,
          ),
        totalPassengers:
          sql<number>`coalesce(${earningTotals.totalPassengers}, 0)`.mapWith(
            Number,
          ),
        activeRoutes:
          sql<number>`coalesce(${routeTotals.activeRoutes}, 0)`.mapWith(Number),
      })
      .from(driverStats)
      .leftJoin(payoutTotals, eq(payoutTotals.driverId, driverStats.driverId))
      .leftJoin(earningTotals, eq(earningTotals.driverId, driverStats.driverId))
      .leftJoin(routeTotals, eq(routeTotals.driverId, driverStats.driverId))
      .where(eq(driverStats.driverId, driverId));

    return {
      ...stats,
      totalEarnings: totals?.totalEarnings ?? 0,
      pendingPayments: totals?.pendingPayments ?? 0,
      totalPassengers: totals?.totalPassengers ?? 0,
      activeRoutes: totals?.activeRoutes ?? 0,
    };
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

  async recordConfirmedBooking(
    tx: DriverTransaction,
    input: {
      driverId: string;
      fareAmountMinor: number;
      tripDate: Date | string;
      departureTime: Date | string;
    },
  ): Promise<void> {
    const stats = await tx.query.driverStats.findFirst({
      where: eq(driverStats.driverId, input.driverId),
    });

    if (!stats) {
      return;
    }

    const tripDateTime = new Date(input.tripDate);
    const departureDateTime = new Date(input.departureTime);
    const now = new Date();
    const tripDateKey = formatDateKey(tripDateTime);
    const todayKey = formatDateKey(now);
    const tomorrowKey = addDaysToDateKey(todayKey, 1);

    const isFutureTrip = tripDateKey >= tomorrowKey;
    const isSameDayTrip = tripDateKey === todayKey;
    const hasNotDeparted = isSameDayTrip && departureDateTime > now;

    await tx
      .update(driverStats)
      .set({
        pendingPayments:
          isFutureTrip || hasNotDeparted
            ? stats.pendingPayments + input.fareAmountMinor
            : stats.pendingPayments,
        totalPassengers: stats.totalPassengers + 1,
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
    const stats = await tx.query.driverStats.findFirst({
      where: eq(driverStats.driverId, input.driverId),
    });

    if (!stats) {
      return;
    }

    await tx
      .update(driverStats)
      .set({
        totalEarnings: stats.totalEarnings + input.amountMinor,
        pendingPayments: Math.max(0, stats.pendingPayments - input.amountMinor),
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, input.driverId));
  }

  async recordRouteCreated(
    tx: DriverTransaction,
    driverId: string,
  ): Promise<void> {
    const stats = await tx.query.driverStats.findFirst({
      where: eq(driverStats.driverId, driverId),
    });

    if (!stats) {
      return;
    }

    await tx
      .update(driverStats)
      .set({
        activeRoutes: stats.activeRoutes + 1,
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, driverId));
  }

  async recordRouteDeleted(
    tx: DriverTransaction,
    driverId: string,
  ): Promise<void> {
    const stats = await tx.query.driverStats.findFirst({
      where: eq(driverStats.driverId, driverId),
    });

    if (!stats) {
      return;
    }

    await tx
      .update(driverStats)
      .set({
        activeRoutes: Math.max(0, stats.activeRoutes - 1),
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, driverId));
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
