import { addDays, format } from "date-fns";

export interface UpcomingDateSlot {
  dateKey: string;
  day: string;
  date: number;
  isPast: boolean;
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
