import { createServiceError } from "@shared/utils";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateKey(value: string): string {
  const trimmed = value.trim();
  if (!DATE_ONLY_REGEX.test(trimmed)) {
    throw createServiceError("Date must be in YYYY-MM-DD format", 400);
  }
  return trimmed;
}
