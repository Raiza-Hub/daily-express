import { createServiceError } from "@shared/utils";

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
