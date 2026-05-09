import type { Route } from "@shared/types";
import { sql } from "drizzle-orm";

import { createServiceError } from "@shared/utils";
import { booking, driver, users } from "../db/index";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ROUTE_SERVICE_TIMEZONE =
  process.env.ROUTE_SERVICE_TIMEZONE || "Africa/Lagos";
const VISIBLE_BOOKING_STATUSES = ["confirmed", "completed"] as const;
const HIDDEN_BOOKING_PAYMENT_STATUSES = ["failed", "cancelled", "expired"];

type BookingRecord = typeof booking.$inferSelect;

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isVisibleBooking(record: BookingRecord): boolean {
  return (
    VISIBLE_BOOKING_STATUSES.includes(
      record.status as (typeof VISIBLE_BOOKING_STATUSES)[number],
    ) && !HIDDEN_BOOKING_PAYMENT_STATUSES.includes(record.paymentStatus)
  );
}

export function createNormalizedSearchScore(
  column: any,
  rawQuery: string,
  normalizedQuery: string,
) {
  const normalizedColumn = sql`lower(regexp_replace(${column}, '\s+', ' ', 'g'))`;
  const containsNormalizedQuery = `%${normalizedQuery}%`;

  return sql<number>`greatest(
    similarity(${column}, ${rawQuery}),
    similarity(${normalizedColumn}, ${normalizedQuery}),
    CASE
      WHEN ${normalizedColumn} LIKE ${containsNormalizedQuery} THEN 1
      ELSE 0
    END
  )`;
}

export function isConstraintError(
  error: unknown,
  constraintName: string,
): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const dbError = error as {
    code?: string;
    constraint?: string;
    constraint_name?: string;
    message?: string;
  };

  return (
    dbError.code === "23505" &&
    (dbError.constraint === constraintName ||
      dbError.constraint_name === constraintName ||
      dbError.message?.includes(constraintName) === true)
  );
}

export function parseDateKey(value: string): string {
  const trimmed = value.trim();
  if (!DATE_ONLY_REGEX.test(trimmed)) {
    throw createServiceError("Date must be in YYYY-MM-DD format", 400);
  }
  return trimmed;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = date.getUTCFullYear();
  const nextMonth = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const nextDay = `${date.getUTCDate()}`.padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function getDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const parts = getDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
): Date {
  const utcGuess = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond),
  );
  const offset = getTimeZoneOffsetMilliseconds(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

export function getBusinessDayWindow(dateInput: string) {
  const dateKey = parseDateKey(dateInput);
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = zonedDateTimeToUtc(
    year,
    month,
    day,
    0,
    0,
    0,
    0,
    ROUTE_SERVICE_TIMEZONE,
  );
  const nextDateKey = addDaysToDateKey(dateKey, 1);
  const [nextYear, nextMonth, nextDay] = nextDateKey.split("-").map(Number);
  const end = zonedDateTimeToUtc(
    nextYear,
    nextMonth,
    nextDay,
    0,
    0,
    0,
    0,
    ROUTE_SERVICE_TIMEZONE,
  );

  return { dateKey, start, end };
}

export function getScheduledDepartureTime(
  tripDate: string,
  departureTime: Date,
) {
  const dateKey = parseDateKey(tripDate);
  const [year, month, day] = dateKey.split("-").map(Number);
  const timeParts = getDateTimeParts(departureTime, ROUTE_SERVICE_TIMEZONE);

  return zonedDateTimeToUtc(
    year,
    month,
    day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
    departureTime.getMilliseconds(),
    ROUTE_SERVICE_TIMEZONE,
  );
}

export function formatBusinessDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ROUTE_SERVICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function mapDriverToRouteDriver(
  record: typeof driver.$inferSelect,
): Route["driver"] {
  return {
    id: record.id,
    firstName: record.firstName,
    lastName: record.lastName,
    phone: record.phone,
    profile_pic: record.profile_pic ?? null,
    country: record.country,
    state: record.state,
  };
}

export function mapPassenger(record: typeof users.$inferSelect) {
  return {
    id: record.id,
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    profilePictureUrl: record.profilePictureUrl,
  };
}
