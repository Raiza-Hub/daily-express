import dayjs from "dayjs";
import { BusIcon, CarIcon, SparkleIcon } from "@phosphor-icons/react";
import { getAllDriverRoutesFn } from "@repo/api";

export type DriverRoute = Awaited<ReturnType<typeof getAllDriverRoutesFn>>[number];

export const statusStyles: Record<DriverRoute["status"], string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  inactive: "bg-slate-100 text-slate-700 border-slate-200",
};

export const vehicleMeta: Record<
  DriverRoute["vehicleType"],
  { label: string; Icon: typeof CarIcon }
> = {
  car: { label: "Car", Icon: CarIcon },
  bus: { label: "Bus", Icon: BusIcon },
  luxury_car: { label: "Luxury Car", Icon: SparkleIcon },
};

export function formatRouteStatus(status: DriverRoute["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function sortDriverRoutes(routes: DriverRoute[]) {
  return [...routes].sort(
    (a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf(),
  );
}
