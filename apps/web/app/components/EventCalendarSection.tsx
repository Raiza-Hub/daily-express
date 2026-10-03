"use client";

import { addDays, addHours, format, isValid, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useGetDriverTrips } from "@repo/api";

import {
  EventCalendar,
  type CalendarEvent,
} from "~/components/event-calendar";
import { AgendaDaysToShow } from "~/components/event-calendar/constants";

function parseTripDateTime(dateStr: string, timeStr: string): Date {
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const isoString = `${dateStr}T${normalizedTime}`;
  const parsed = new Date(isoString);
  return Number.isNaN(parsed.getTime()) ? parseISO(dateStr) : parsed;
}

export function EventCalendarSection({
  from,
  to,
}: {
  from?: string;
  to?: string;
}) {
  const router = useRouter();

  // The URL owns the visible window, so the view survives reload and sharing.
  const currentDate = useMemo(() => {
    const parsed = from ? parseISO(from) : new Date();
    return isValid(parsed) ? parsed : new Date();
  }, [from]);

  const rangeTo = useMemo(() => {
    const parsed = to ? parseISO(to) : null;
    if (parsed && isValid(parsed)) return parsed;
    return addDays(currentDate, AgendaDaysToShow - 1);
  }, [to, currentDate]);

  const { data: trips = [], isLoading, isError } = useGetDriverTrips({
    from: format(currentDate, "yyyy-MM-dd"),
    to: format(rangeTo, "yyyy-MM-dd"),
  });

  const events: CalendarEvent[] = useMemo(() => {
    return trips
      .map((trip) => {
        const start = parseTripDateTime(trip.date, trip.departureTime);
        return {
          id: trip.id,
          origin: trip.origin,
          destination: trip.destination,
          start,
          end: addHours(start, 1),
          tripStatus: trip.tripStatus,
          status: trip.status,
          price: trip.price,
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [trips]);

  const handleNavigate = (date: Date) => {
    router.replace(
      `/driver/calendar?from=${format(date, "yyyy-MM-dd")}&to=${format(
        addDays(date, AgendaDaysToShow - 1),
        "yyyy-MM-dd",
      )}`,
      { scroll: false },
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Driver calendar
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Plan route briefings, maintenance, and personal schedules.
        </p>
      </div>

      {isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          We couldn&apos;t load your trips. Please refresh to try again.
        </div>
      ) : (
        <EventCalendar
          currentDate={currentDate}
          events={events}
          isLoading={isLoading}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}
