export interface CalendarEvent {
  id: string;
  origin: string;
  destination: string;
  start: Date;
  end: Date;
  passengers?: EventCalendarPassenger[];
  status: EventStatus;
  price: number;
}

export interface EventCalendarPassenger {
  id: string;
  fullName: string;
  phone: string;
  carriesLuggage?: boolean;
}

export type EventStatus = "paid" | "cancelled" | "upcoming" | "pending_payment";