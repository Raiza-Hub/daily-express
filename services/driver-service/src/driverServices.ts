import { Driver, UpdateProfileRequest } from "@shared/types";
import { AuthClient } from "./authClient";
import { db } from "../db/db";
import { driver } from "../db/schema";
import { eq } from "drizzle-orm";
import { createServiceError, sanitizeInput } from "@shared/utils";
import { Producer, Consumer } from "kafkajs";

export class DriverService {
  private authClient: AuthClient;
  private producer: Producer;
  private consumer: Consumer;

  constructor(producer: Producer, consumer: Consumer) {
    this.authClient = new AuthClient();
    this.producer = producer;
    this.consumer = consumer;
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

    //send mail with kafka
    try {
      await this.producer.send({
        topic: "driver-created",
        messages: [
          {
            value: JSON.stringify({
              email: newDriver.email,
              subject: "Driver Profile Created",
              text: `Your driver profile has been created successfully`,
            }),
          },
        ],
      });
    } catch (error) {
      console.error(error.message);
      console.error(
        "Failed to send driver profile creation email, please try again later",
      );
    }

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

  //consumer
  async startConsuming() {
    try {
      await this.consumer.run({
        eachMessage: async ({ topic, message }) => {
          const value = message.value?.toString();
          if (!value) return;
          // auth-service sends: { userId }
          const { userId } = JSON.parse(value);
          switch (topic) {
            case "user-deleted":
              await this.deleteDriver(userId);
              console.log("Driver deleted successfully");
              break;
          }
        },
      });
    } catch (error: any) {
      if (error.statusCode) throw error;
      throw createServiceError(
        error.message || "Failed to start consumer",
        500,
      );
    }
  }
  async deleteDriver(userId: string): Promise<void> {
    //check if user exists
    const existingDriver = await db.query.driver.findFirst({
      where: eq(driver.userId, userId),
    });
    if (!existingDriver) {
      throw createServiceError("Driver not found", 404);
    }
    const driverId = existingDriver.id;

    //delete driver routes using kafka
    await this.producer.send({
      topic: "driver-deleted",
      messages: [
        {
          value: JSON.stringify({ driverId, userId }),
        },
      ],
    });

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
