import { sql, type Column, type SQL } from "drizzle-orm";
import { getConfig } from "../config/index";

export function getRouteServiceTimeZone() {
  return getConfig().ROUTE_SERVICE_TIMEZONE;
}

/**
 * Combines a calendar day and a wall-clock time into a timestamptz instant in
 * the business timezone: `(date + time) AT TIME ZONE tz`.
 * e.g. "2026-09-21" + "08:00" in Africa/Lagos → 2026-09-21T07:00:00.000Z
 */
export function scheduledAtSql(
  dateColumn: SQL | Column | string,
  timeColumn: SQL | Column | string,
  timeZone = getRouteServiceTimeZone(),
): SQL {
  return sql`((${dateColumn} + ${timeColumn}::time) AT TIME ZONE ${timeZone})`;
}