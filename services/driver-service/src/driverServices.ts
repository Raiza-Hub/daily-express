import { Driver, UpdateProfileRequest } from "@shared/types";
import { AuthClient } from "./authClient";
import { db } from "../db/db";
import { driver } from "../db/schema";
import { eq } from "drizzle-orm";
import { createServiceError, sanitizeInput } from "@shared/utils";

export class DriverService {
  private authClient: AuthClient;

  constructor() {
    this.authClient = new AuthClient();
  }

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

    //create new driver
    const [newDriver] = await db
      .insert(driver)
      .values({ ...sanitizeData, userId } as any)
      .returning();

    return newDriver;
  }

  async getProfile(userId: string): Promise<Driver> {
    //check if user exists
    const existingDriver = await db.query.driver.findFirst({
      where: eq(driver.userId, userId),
    });
    if (!existingDriver) {
      throw createServiceError("Driver not found", 404);
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

    //update existsing driver
    const [updatedDriver] = await db
      .update(driver)
      .set(sanitizedData)
      .where(eq(driver.userId, userId))
      .returning();

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

    //delete driver
    await db.delete(driver).where(eq(driver.userId, userId));
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
    if (data.gender !== undefined) {
      sanitized.gender = data.gender ? sanitizeInput(data.gender) : null;
    }
    if (data.country !== undefined) {
      sanitized.country = data.country ? sanitizeInput(data.country) : null;
    }
    if (data.state !== undefined) {
      sanitized.state = data.state ? sanitizeInput(data.state) : null;
    }
    if (data.city !== undefined) {
      sanitized.city = data.city ? sanitizeInput(data.city) : null;
    }
    if (data.bankName !== undefined) {
      sanitized.bankName = data.bankName ? sanitizeInput(data.bankName) : null;
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
