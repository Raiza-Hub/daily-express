import type { JWTPayload } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { eq } from "drizzle-orm";
import { db } from "../db/connection";
import { driver } from "../db/index";

export async function resolveDriverRecord(user: JWTPayload) {
  const driverRecord = await db.query.driver.findFirst({
    where: eq(driver.userId, user.userId),
  });

  if (!driverRecord) {
    throw createServiceError("Driver not found", 404);
  }

  return driverRecord;
}

export async function resolveDriverId(user: JWTPayload): Promise<string> {
  const driverRecord = await resolveDriverRecord(user);
  return driverRecord.id;
}
