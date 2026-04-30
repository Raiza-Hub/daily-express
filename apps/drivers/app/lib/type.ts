export interface Bank {
  name: string;
  slug: string;
  code: string;
  country: string;
  nibss_bank_code: string;
}

export type NotificationTab = "all" | "unread";

export interface RouteWithTrips {
  id: string;
  tripId: string;
  departureTime: string;
  departureCode: string;
  arrivalTime: string;
  arrivalCode: string;
  bookedSeats: number;
  capacity: number;
  departureCity: { title: string; locality: string };
  arrivalCity: { title: string; locality: string };
}
