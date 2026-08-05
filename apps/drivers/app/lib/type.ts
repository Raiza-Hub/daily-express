export interface Bank {
  name: string;
  slug: string;
  code: string;
  country: string;
  nibss_bank_code: string;
}

export interface RouteWithTrips {
  id: string;
  tripId: string;
  status: string;
  tripDate: string;
  departureTime: string;
  departureCode: string;
  arrivalTime: string;
  arrivalAt: string;
  arrivalCode: string;
  bookedSeats: number;
  capacity: number;
  payoutStatus?: string | null;
  departureCity: { title: string; label: string; locality: string };
  arrivalCity: { title: string; label: string; locality: string };
}
