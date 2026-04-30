import { NotificationTone } from "@shared/types";
import { BusIcon, CarIcon, SparkleIcon } from "@phosphor-icons/react";
import { getAllDriverRoutesFn } from "@repo/api";


export function formatDate(dateString?: string | null) {
  if (!dateString) {
    return "Not scheduled";
  }

  return new Date(dateString).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function combineTripDateAndTime(
  tripDate: Date,
  timeSource: Date | string,
): Date {
  const source = new Date(timeSource);
  const combined = new Date(tripDate);

  combined.setHours(
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds(),
  );

  return combined;
}

export function formatCurrency(amountMinor: number, currency: string = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function getRouteAnalyticsProperties(route: {
  id?: string;
  pickup_location_title: string;
  pickup_location_locality: string;
  dropoff_location_title: string;
  dropoff_location_locality: string;
  vehicleType: "car" | "bus" | "luxury_car";
  availableSeats: number;
  price: number;
  departure_time: Date | string;
  arrival_time: Date | string;
  status?: "inactive" | "pending" | "active";
}) {
  return {
    route_id: route.id,
    origin_title: route.pickup_location_title,
    origin_locality: route.pickup_location_locality,
    destination_title: route.dropoff_location_title,
    destination_locality: route.dropoff_location_locality,
    vehicle_type: route.vehicleType,
    available_seats: route.availableSeats,
    price: route.price,
    departure_time: new Date(route.departure_time).toISOString(),
    arrival_time: new Date(route.arrival_time).toISOString(),
    route_status: route.status,
  };
}

export function formatRelativeTime(timestamp: Date | string) {
  const diffMs = new Date(timestamp).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round(diffMs / (1000 * 60));
  const hours = Math.round(diffMs / (1000 * 60 * 60));
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(minutes) < 60) {
    return rtf.format(minutes, "minute");
  }

  if (Math.abs(hours) < 24) {
    return rtf.format(hours, "hour");
  }

  if (Math.abs(days) < 7) {
    return rtf.format(days, "day");
  }

  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
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
