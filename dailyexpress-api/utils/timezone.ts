import { getConfig } from "../config/index";

export function getRouteServiceTimeZone() {
  return getConfig().ROUTE_SERVICE_TIMEZONE;
}

export function getDateTimeParts(
  date: Date,
  timeZone = getRouteServiceTimeZone(),
) {
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

export function formatDateKey(
  date: Date,
  timeZone = getRouteServiceTimeZone(),
) {
  const parts = getDateTimeParts(date, timeZone);
  const month = `${parts.month}`.padStart(2, "0");
  const day = `${parts.day}`.padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function formatRouteDate(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: getRouteServiceTimeZone(),
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatRouteTime(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: getRouteServiceTimeZone(),
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getStartOfTodayInRouteTimezone(): Date {
  const tz = getRouteServiceTimeZone();
  const todayKey = formatDateKey(new Date(), tz);
  const utcMidnight = new Date(`${todayKey}T00:00:00.000Z`);
  const parts = getDateTimeParts(utcMidnight, tz);
  const localAtUtcMidnight = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  const offsetMs = localAtUtcMidnight - utcMidnight.getTime();
  return new Date(utcMidnight.getTime() - offsetMs);
}
