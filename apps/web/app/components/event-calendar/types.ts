import type { TripStatus } from "@shared/types";

export interface CalendarEvent {
  id: string;
  origin: string;
  destination: string;
  start: Date;
  end: Date;
  status: EventStatus;
  tripStatus: TripStatus;
  price: number;
}

export interface EventCalendarPassenger {
  id: string;
  fullName: string;
  phone?: string;
  carriesLuggage?: boolean;
}

export type EventStatus = "pending" | "successful" | "cancelled";
