import type { TRoute } from "@repo/types/routeSchema";
import { DriverInfoProps } from "~/components/DriverInfo";
import { parseAsArrayOf, parseAsString } from "nuqs";


export type SubmittedTripSearch = {
  from: string;
  to: string;
  date: string;
  vehicleType?: string[];
};

export interface SearchTrip {
  searchResultId: string;
  routeId: string;
  route: TRoute;
  capacity: number;
  remainingSeats: number;
  driver: {
    firstName: string;
    lastName: string;
    phone: string;
    profile_pic: string | null;
    country: string;
    state: string;
  };
}

export interface BookingContext {
  routeId: string;
  tripDate: string;
  remainingSeats: number;
}

export interface TripStatusItem {
  id: string;
  createdAt: Date | string;
  trip: TRoute;
  driver?: DriverInfoProps;
  routeId: string;
  tripDate: string;
  remainingSeats: number;
}



export const searchParams = {
  from: parseAsString,
  to: parseAsString,
  date: parseAsString,
  vehicleType: parseAsArrayOf(parseAsString),
};

export type SearchParams = {
  from: string | null;
  to: string | null;
  date: string | null;
  vehicleType: string[] | null;
};
