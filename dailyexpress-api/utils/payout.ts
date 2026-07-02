export const KORA_ERROR_CODES = {
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  INVALID_ACCOUNT: "INVALID_ACCOUNT",
  BANK_PROCESSING_ERROR: "BANK_PROCESSING_ERROR",
  DUPLICATE_REFERENCE: "DUPLICATE_REFERENCE",
} as const;

const FATAL_KORA_ERRORS = new Set<string>([
  KORA_ERROR_CODES.INVALID_ACCOUNT,
  KORA_ERROR_CODES.DUPLICATE_REFERENCE,
]);
const RETRYABLE_KORA_ERRORS = new Set<string>([
  KORA_ERROR_CODES.BANK_PROCESSING_ERROR,
]);

export function parseDelayString(value: string): number[] {
  return value
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isFinite(item) && item > 0);
}

export function parseMajorCurrencyToMinor(
  value: number | string | null | undefined,
): number {
  if (typeof value === "number") {
    return Math.round(value * 100);
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }
  return 0;
}

export function isRetryableKoraError(errorCode?: string): boolean {
  return errorCode ? RETRYABLE_KORA_ERRORS.has(errorCode) : false;
}

export function isFatalKoraError(errorCode?: string): boolean {
  return errorCode ? FATAL_KORA_ERRORS.has(errorCode) : false;
}

export function formatAmountMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}
