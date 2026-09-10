import type { TRoute } from "@repo/types/routeSchema";
import { DriverInfoProps } from "~/components/DriverInfo";
import { createLoader, parseAsString } from "nuqs/server";


export type SubmittedTripSearch = {
  origin: string;
  date: string;
  vehicleType?: string[];
};

export interface BookingContext {
  tripDate: string;
}

export interface TripStatusItem {
  id: string;
  trip: TRoute;
  driver?: DriverInfoProps;
  routeId: string;
  tripDate: string;
  remainingSeats: number;
  paymentStatus: string;
  driverStatus: string;
  fareAmount: number;
  displayMessage?: string | null;
  feeAmount?: number;
}



export const searchParams = {
  origin: parseAsString,
  date: parseAsString,
};

export const loadSearchParams = createLoader(searchParams);

export type SearchParams = {
  origin: string | null;
  date: string | null;
};
