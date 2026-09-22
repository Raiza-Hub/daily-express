import { addDays, format } from "date-fns";

export interface UpcomingDateSlot {
  dateKey: string;
  day: string;
  date: number;
  isPast: boolean;
}

export interface TripDestination {
  id: string;
  title: string;
  locality: string;
}

export interface TripOrigin {
  id: string;
  title: string;
  locality: string;
  departureTime: string[];
  meetingPoint: string;
  fare: number;
  fee: number;
  luggageFee: number;
  destinationIds: string[];
}

export const MOCK_DESTINATIONS: TripDestination[] = [
  {
    id: "dest-wole-soyinka",
    title: "Professor Wole Soyinka Station Abeokuta",
    locality: "Abeokuta",
  },
  {
    id: "dest-lagos-cbd",
    title: "Lagos Central Business District",
    locality: "Lagos",
  },
];

export const MOCK_ORIGINS: TripOrigin[] = [
  {
    id: "origin-funaab",
    title: "Federal University of Agriculture, Abeokuta.",
    locality: "Abeokuta",
    departureTime: ["08:00", "10:00", "12:00", "14:00"],
    meetingPoint: "University Gate",
    fare: 4500,
    fee: 500,
    luggageFee: 1000,
    destinationIds: ["dest-wole-soyinka", "dest-lagos-cbd"],
  },
];

export function getDestinationsForOrigin(origin: TripOrigin): TripDestination[] {
  return MOCK_DESTINATIONS.filter((destination) =>
    origin.destinationIds.includes(destination.id),
  );
}

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function getUpcomingDateSlots(days = 7): UpcomingDateSlot[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index);
    return {
      dateKey: toDateKey(date),
      day: format(date, "EEE"),
      date: date.getDate(),
      isPast: false,
    };
  });
}

export function formatTripTime(time: string): string {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return format(date, "h:mm a");
}
