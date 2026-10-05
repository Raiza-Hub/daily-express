import { addHours, isAfter, isBefore, isSameDay, startOfDay, endOfDay } from "date-fns";

import type { CalendarEvent } from "~/components/event-calendar/types";

export function getAgendaEventsForDay(
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  return events
    .filter((event) => {
      return (
        isSameDay(event.start, day) ||
        isSameDay(event.end, day) ||
        (isBefore(event.start, dayEnd) && isAfter(event.end, dayStart))
      );
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function addHoursToDate(date: Date, hours: number): Date {
  return addHours(date, hours);
}
