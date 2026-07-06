import type { Route } from "@shared/types";
import { SearchTrip, TripStatusItem } from "./type";
import { type UserBookingWithTrip } from "@repo/api";
import dayjs from "dayjs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(\d{2}):(\d{2}):(\d{2})$/;

export function parseTimeString(time: string | Date, baseDate: Date): Date {
  if (time instanceof Date) return time;
  const match = time.match(TIME_PATTERN);
  if (!match) return new Date(NaN);
  const [, hours, minutes, seconds] = match;
  const d = new Date(baseDate);
  d.setHours(Number(hours), Number(minutes), Number(seconds), 0);
  return d;
}

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

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


export function parseLocalDate(date: string): Date {
  if (!isValidDateString(date)) {
    return new Date();
  }

  const parts = date.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  if (year === undefined || month === undefined || day === undefined) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

export function toSearchTrip(item: Route, tripDate?: string): SearchTrip {
  const baseDate = tripDate ? parseLocalDate(tripDate) : new Date();
  return {
    searchResultId: item.id,
    routeId: item.id,
    pickupLocationTitle: item.pickup_location_title,
    pickupLocationLocality: item.pickup_location_locality,
    pickupLocationLabel: item.pickup_location_label,
    dropoffLocationTitle: item.dropoff_location_title,
    dropoffLocationLocality: item.dropoff_location_locality,
    dropoffLocationLabel: item.dropoff_location_label,
    priceCar: item.priceCar,
    priceBus: item.priceBus,
    departureTime: parseTimeString(item.departure_time, baseDate),
    estimatedArrivalTime: parseTimeString(item.arrival_time, baseDate),
    meetingPoint: item.meeting_point,
  };
}

export function transformToTripStatusItem(
  booking: UserBookingWithTrip,
): TripStatusItem | null {
  if (!booking.trip?.route) {
    return null;
  }

  const trip = booking.trip;
  const route = trip.route;
  const tripDate = new Date(trip.date);
  const departureTime = parseTimeString(route.departure_time, tripDate);
  let estimatedArrivalTime = parseTimeString(route.arrival_time, tripDate);

  if (estimatedArrivalTime <= departureTime) {
    estimatedArrivalTime = dayjs(estimatedArrivalTime).add(1, "day").toDate();
  }

  return {
    id: booking.id,
    driver: booking.driverInfo
      ? {
          firstName: booking.driverInfo.firstName,
          lastName: booking.driverInfo.lastName,
          phoneNumber: booking.driverInfo.phoneNumber,
          country: booking.driverInfo.country,
          state: booking.driverInfo.state,
          profilePictureUrl: booking.driverInfo.profilePictureUrl ?? "",
          vehicleMake: booking.driverInfo.vehicleMake,
          vehicleModel: booking.driverInfo.vehicleModel,
          vehiclePlateNumber: booking.driverInfo.vehiclePlateNumber,
          vehicleColor: booking.driverInfo.vehicleColor,
        }
      : undefined,
    displayMessage: booking.displayMessage,
    routeId: route.id,
    tripDate: formatLocalDate(tripDate),
    remainingSeats: trip.availableSeats,
    paymentStatus: booking.paymentStatus,
    driverStatus: booking.driverStatus,
    trip: {
      departureCity: {
        title: route.pickup_location_title,
        locality: route.pickup_location_locality,
        label: route.pickup_location_label,
      },
      arrivalCity: {
        title: route.dropoff_location_title,
        locality: route.dropoff_location_locality,
        label: route.dropoff_location_label,
      },
      vehicleType: route.vehicle_type as "car" | "bus",
      seatNumber: trip.capacity,
      priceCar: booking.fareAmount,
      priceBus: booking.fareAmount,
      departureTime,
      estimatedArrivalTime,
      meetingPoint: route.meeting_point,
    },
  };
}

export function groupByDate(
  items: TripStatusItem[],
): Map<string, TripStatusItem[]> {
  const groups = new Map<string, TripStatusItem[]>();
  for (const item of items) {
    const key = dayjs(item.trip.departureTime).format("MMM D, YYYY");
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}
