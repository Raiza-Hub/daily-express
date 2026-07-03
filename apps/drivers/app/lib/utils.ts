import { NotificationTone } from "@shared/types";


const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;

  const parts = value.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }

  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function getDateInTz(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  return {
    year: parseInt(parts.find((p) => p.type === "year")!.value, 10),
    month: parseInt(parts.find((p) => p.type === "month")!.value, 10),
    day: parseInt(parts.find((p) => p.type === "day")!.value, 10),
  };
}

export function combineTripDateAndTime(
  tripDate: Date,
  timeSource: Date | string,
): Date {
  const { year, month, day } = getDateInTz(tripDate, "Africa/Lagos");
  const combined = new Date(year, month - 1, day);

  if (typeof timeSource === "string") {
    const [hours = 0, minutes = 0, seconds = 0] = timeSource.split(":").map(Number);
    combined.setHours(hours, minutes, seconds, 0);
  } else {
    combined.setHours(
      timeSource.getHours(),
      timeSource.getMinutes(),
      timeSource.getSeconds(),
      timeSource.getMilliseconds(),
    );
  }

  return combined;
}

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
});

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  month: "short",
  day: "numeric",
});

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string) {
  if (currency === "NGN") return currencyFormatter;
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    });
    currencyFormatters.set(currency, fmt);
  }
  return fmt;
}

export function formatCurrency(amountMinor: number, currency: string = "NGN") {
  return getCurrencyFormatter(currency).format(amountMinor / 100);
}

export function formatRelativeTime(timestamp: Date | string) {
  const diffMs = new Date(timestamp).getTime() - Date.now();
  const minutes = Math.round(diffMs / (1000 * 60));
  const hours = Math.round(diffMs / (1000 * 60 * 60));
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(minutes) < 60) {
    return relativeFormatter.format(minutes, "minute");
  }

  if (Math.abs(hours) < 24) {
    return relativeFormatter.format(hours, "hour");
  }

  if (Math.abs(days) < 7) {
    return relativeFormatter.format(days, "day");
  }

  return dateFormatter.format(new Date(timestamp));
}

export function getToneClasses(tone: NotificationTone) {
  switch (tone) {
    case "critical":
      return {
        dot: "bg-red-500",
        pill: "border-red-200 bg-red-50 text-red-700",
      };
    case "attention":
      return {
        dot: "bg-amber-500",
        pill: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "positive":
      return {
        dot: "bg-emerald-500",
        pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    default:
      return {
        dot: "bg-sky-500",
        pill: "border-sky-200 bg-sky-50 text-sky-700",
      };
  }
}


