import type { TRoute } from "@repo/types/routeSchema";
import { DriverInfoProps } from "~/components/DriverInfo";
import { parseAsString, parseAsStringLiteral } from "nuqs";


export type SubmittedTripSearch = {
  from: string;
  to: string;
  date: string;
  vehicleType?: string[];
};

export interface SearchTrip {
  searchResultId: string;
  routeId: string;
  pickupLocationTitle: string;
  pickupLocationLocality: string;
  pickupLocationLabel: string;
  dropoffLocationTitle: string;
  dropoffLocationLocality: string;
  dropoffLocationLabel: string;
  priceCar: number;
  priceBus: number;
  departureTime: Date;
  estimatedArrivalTime: Date;
  meetingPoint: string;
}

export interface BookingContext {
  routeId: string;
  tripDate: string;
  remainingSeats: number;
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
  displayMessage?: string | null;
}



export const searchParams = {
  from: parseAsString,
  to: parseAsString,
  date: parseAsString,
  departureTime: parseAsStringLiteral(["morning", "afternoon"]),
};

export type SearchParams = {
  from: string | null;
  to: string | null;
  date: string | null;
  departureTime: "morning" | "afternoon" | null;
};
