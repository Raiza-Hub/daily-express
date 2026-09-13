import { createServiceError } from "@shared/utils";
import {
  formatDateKey,
  getDateTimeParts,
  getRouteServiceTimeZone,
} from "./timezone";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const HIDDEN_BOOKING_PAYMENT_STATUSES = [
  "failed",
  "cancelled",
  "expired",
  "refund_pending",
  "refunded",
  "refund_failed",
];

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
  const timeZone = getRouteServiceTimeZone();
  const start = zonedDateTimeToUtc(year, month, day, 0, 0, 0, 0, timeZone);
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
    timeZone,
  );

  return { dateKey, start, end };
}

export function getScheduledDepartureTime(
  tripDate: string,
  departureTime: string,
) {
  const dateKey = parseDateKey(tripDate);
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute, second = 0] = departureTime.split(":").map(Number);
  const timeZone = getRouteServiceTimeZone();

  return zonedDateTimeToUtc(
    year,
    month,
    day,
    hour,
    minute,
    second,
    0,
    timeZone,
  );
}

export function formatBusinessDate(date: Date): string {
  return formatDateKey(date);
}
