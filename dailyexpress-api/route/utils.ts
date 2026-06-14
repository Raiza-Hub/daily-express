import type { JWTPayload } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { eq } from "drizzle-orm";
import { db } from "../db/connection";
import { driver, route, trip } from "../db/index";
import {
    formatBusinessDate,
    getScheduledDepartureTime,
} from "../utils/route";

export const ALLOWED_VEHICLE_TYPES = ["car", "bus", "luxury car"] as const;
export const ROUTE_DUPLICATE_CONSTRAINT =
  "route_driver_origin_destination_departure_unique_idx";
export const ACTIVE_BOOKING_CONSTRAINT = "booking_trip_id_user_id_active_idx";
export const ROUTE_SEARCH_SCORE_THRESHOLD = 0.15;
export const BOOKABLE_TRIP_STATUSES = new Set(["pending", "confirmed"]);
export const VISIBLE_BOOKING_STATUSES = ["confirmed", "completed"] as const;
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 50;

export type VehicleType = (typeof ALLOWED_VEHICLE_TYPES)[number];
type RouteRecord = typeof route.$inferSelect;
type TripRecord = typeof trip.$inferSelect;
type DriverRecord = typeof driver.$inferSelect;

export function normalizePageLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) {
    return DEFAULT_PAGE_LIMIT;
  }
  return Math.max(1, Math.min(MAX_PAGE_LIMIT, Math.floor(limit)));
}

export function encodeCursor<T extends object>(value: T): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor<T extends object>(
  cursor: string | undefined,
  isValid: (value: unknown) => value is T,
): T | null {
  if (!cursor) return null;

  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (value && typeof value === "object" && isValid(value)) {
      return value;
    }
  } catch {}

  throw createServiceError("Invalid cursor", 400, "INVALID_CURSOR");
}

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

export function isValidUserBookingsCursor(value: unknown): value is { createdAt: string } {
  if (!value || typeof value !== "object") return false;
  const cursor = value as Record<string, unknown>;
  return (
    typeof cursor.createdAt === "string" &&
    !Number.isNaN(new Date(cursor.createdAt).getTime())
  );
}

export function getTripArrivalAt(tripRecord: TripRecord, routeRecord: RouteRecord) {
  const dateKey = formatBusinessDate(tripRecord.date);
  const departureAt = getScheduledDepartureTime(
    dateKey,
    routeRecord.departure_time,
  );
  const arrivalAt = getScheduledDepartureTime(
    dateKey,
    routeRecord.arrival_time,
  );

  if (arrivalAt <= departureAt) {
    return new Date(arrivalAt.getTime() + 24 * 60 * 60 * 1000);
  }

  return arrivalAt;
}
