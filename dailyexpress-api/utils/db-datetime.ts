import { sql, type Column, type SQL } from "drizzle-orm";
import { getConfig } from "../config/index";

export function getRouteServiceTimeZone() {
  return getConfig().ROUTE_SERVICE_TIMEZONE;
}

export function scheduledAtSql(
  dateColumn: SQL | Column | string,
  timeColumn: SQL | Column | string,
  timeZone = getRouteServiceTimeZone(),
): SQL {
  return sql`((${dateColumn} + ${timeColumn}::time) AT TIME ZONE ${timeZone})`;
}