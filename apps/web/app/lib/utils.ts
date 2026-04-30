import type { Route } from "@shared/types";
import { SearchTrip, TripStatusItem } from "./type";
import {
  type UserBookingWithTrip,
} from "@repo/api";
import { DriverInfoProps } from "~/components/DriverInfo";
import dayjs from "dayjs";

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

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatCurrency(amountMajor: number, currency: string) {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amountMajor);
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


export function toSearchTrip(item: Route): SearchTrip {
  const capacity = item.availableSeats;
  const remainingSeats = item.remainingSeats;

  return {
    searchResultId: item.id,
    routeId: item.id,
    capacity,
    remainingSeats,
    driver: item.driver,
    route: {
      departureCity: {
        title: item.pickup_location_title,
        locality: item.pickup_location_locality,
        label: item.pickup_location_label,
      },
      arrivalCity: {
        title: item.dropoff_location_title,
        locality: item.dropoff_location_locality,
        label: item.dropoff_location_label,
      },
      vehicleType: item.vehicleType,
      seatNumber: capacity,
      price: item.price,
      departureTime: new Date(item.departure_time),
      estimatedArrivalTime: new Date(item.arrival_time),
      meetingPoint: item.meeting_point,
    },
  };
}

export function combineTripDateAndTime(tripDate: Date, timeSource: Date): Date {
  const combined = new Date(tripDate);

  combined.setHours(
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    timeSource.getMilliseconds(),
  );

  return combined;
}

export function transformToTripStatusItem(booking: UserBookingWithTrip): TripStatusItem | null {
    if (!booking.trip?.route) {
        return null;
    }

    const trip = booking.trip;
    const route = trip.route;
    const tripDate = new Date(trip.date);
    const departureTime = combineTripDateAndTime(
        tripDate,
        new Date(route.departureTime),
    );
    let estimatedArrivalTime = combineTripDateAndTime(
        tripDate,
        new Date(route.arrivalTime),
    );

    if (estimatedArrivalTime <= departureTime) {
        estimatedArrivalTime = dayjs(estimatedArrivalTime).add(1, "day").toDate();
    }

    const driverInfo: DriverInfoProps | undefined = route.driver ? {
        firstName: route.driver.firstName,
        lastName: route.driver.lastName,
        phoneNumber: route.driver.phoneNumber,
        country: route.driver.country,
        state: route.driver.state,
        profilePictureUrl: route.driver.profilePictureUrl || "",
    } : undefined;

    return {
        id: booking.id,
        createdAt: booking.createdAt,
        driver: driverInfo,
        routeId: route.id,
        tripDate: formatLocalDate(tripDate),
        remainingSeats: trip.availableSeats,
        trip: {
            departureCity: {
                title: route.pickupLocationTitle,
                locality: route.pickupLocationLocality,
                label: route.pickupLocationLabel,
            },
            arrivalCity: {
                title: route.dropoffLocationTitle,
                locality: route.dropoffLocationLocality,
                label: route.dropoffLocationLabel,
            },
            vehicleType: route.vehicleType as "car" | "bus" | "luxury_car",
            seatNumber: trip.capacity,
            price: route.price,
            departureTime,
            estimatedArrivalTime,
            meetingPoint: route.meetingPoint,
        },
    };
}

export function groupByDate(items: TripStatusItem[]): Map<string, TripStatusItem[]> {
    const map = new Map<string, TripStatusItem[]>();

    const sorted = [...items].sort((a, b) => {
        return dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf();
    });

    for (const item of sorted) {
        const key = dayjs(item.trip.departureTime).format("MMM D, YYYY");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
    }

    return map;
}
