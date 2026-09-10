import { getConfig, type EnvConfig } from "../config/index";
import { db } from "../db/connection";
import { users } from "../db/index";
import { createServiceError } from "@shared/utils";
import type { UpdateUserRequest, OnboardingInput } from "@shared/types";
import { AuthRepository } from "./auth.repository";
import { DriverRepository } from "../driver/driver.repository";
import { paymentRepository } from "../payment/payment.repository";
import { getStartOfTodayInRouteTimezone } from "../utils/timezone";

interface ConstraintError {
  code?: string;
  constraint?: string;
  message?: string;
}

function isPhoneConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const dbError = error as ConstraintError;
  return (
    dbError.code === "23505" &&
    (dbError.constraint === "users_phone_unique_idx" ||
      dbError.constraint === "users_phone_key" ||
      dbError.message?.includes("users_phone") === true)
  );
}

export class AuthService {
  private readonly repo: AuthRepository;
  private readonly driverRepo: DriverRepository;

  constructor(config: EnvConfig, repo?: AuthRepository) {
    this.repo = repo ?? new AuthRepository();
    this.driverRepo = new DriverRepository();
  }

  async completeOnboarding(userId: string, input: OnboardingInput) {
    try {
      return await db.transaction(async (tx) => {
        const taken = await tx.query.users
          .findFirst({
            where: (table, { and, eq, ne }) =>
              and(eq(table.phone, input.phoneNumber), ne(table.id, userId)),
          });

        if (taken) {
          throw createServiceError("Phone number is already in use", 409, "PHONE_TAKEN");
        }

        return this.repo.updateUser(tx, userId, {
          phone: input.phoneNumber,
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          updatedAt: new Date(),
        });
      });
    } catch (error) {
      if (isPhoneConstraintError(error)) {
        throw createServiceError(
          "Phone number is already in use",
          409,
          "PHONE_TAKEN",
        );
      }
      throw error;
    }
  }

  async getUserById(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw createServiceError("User not found", 404);
    }

    return user;
  }

  async updateProfile(userId: string, data: UpdateUserRequest) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw createServiceError("User not found", 404);
    }

    const set: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (data.firstName !== undefined) set.firstName = data.firstName;
    if (data.lastName !== undefined) set.lastName = data.lastName;
    if (data.dateOfBirth !== undefined) set.dateOfBirth = data.dateOfBirth;
    if (data.phoneNumber !== undefined) set.phone = data.phoneNumber;
    if (data.gender !== undefined) set.gender = data.gender;

    try {
      return await db.transaction(async (tx) =>
        this.repo.updateUser(tx, userId, set),
      );
    } catch (error) {
      if (isPhoneConstraintError(error)) {
        throw createServiceError(
          "Phone number is already in use",
          409,
          "PHONE_TAKEN",
        );
      }
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const existingDriver = await this.repo.findDriverByUserId(userId);

    if (existingDriver) {
      const upcomingTrips = await paymentRepository.findSuccessfulPaymentsForDriverUpcomingTrips(
        existingDriver.id,
        getStartOfTodayInRouteTimezone(),
      );
      if (upcomingTrips.length > 0) {
        throw createServiceError(
          "Cannot delete your account. You have upcoming trips with confirmed bookings.",
          400,
        );
      }
    }

    await db.transaction(async (tx) => {
      if (existingDriver) {
        await this.driverRepo.deactivateDriver(tx, existingDriver.id);
      }

      await this.repo.deleteUserProvidersByUser(tx, userId);

      await this.repo.updateUser(tx, userId, {
        firstName: "[deleted]",
        lastName: "[deleted]",
        email: `deleted-${userId}@dailyexpress.com`,
        dateOfBirth: new Date(0),
        profilePictureUrl: null,
        phone: null,
        gender: null,
        deletedAt: new Date(),
        updatedAt: new Date(),
      });
    });
  }
}