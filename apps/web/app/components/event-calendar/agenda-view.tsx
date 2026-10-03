"use client";

import { CalendarDays } from "lucide-react";
import { addDays, format, isSameDay } from "date-fns";
import { useMemo } from "react";

import { AgendaDaysToShow } from "~/components/event-calendar/constants";
import { EventItem } from "~/components/event-calendar/event-item";
import type { CalendarEvent } from "~/components/event-calendar/types";
import { getAgendaEventsForDay } from "~/components/event-calendar/utils";

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  isLoading?: boolean;
  onEventSelect: (event: CalendarEvent) => void;
}

function EventSkeleton() {
  return (
    <div
      aria-hidden
      className="flex w-full animate-pulse flex-col gap-1 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900"
    >
      <div className="h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-2 h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-4 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="my-3 h-px w-full bg-border" />
      <div className="h-3 w-40 rounded bg-neutral-200 dark:bg-neutral-800" />
    </div>
  );
}

export function AgendaView({
  currentDate,
  events,
  isLoading = false,
  onEventSelect,
}: AgendaViewProps) {
  // Show events for the next days based on constant
  const days = useMemo(() => {
    return Array.from({ length: AgendaDaysToShow }, (_, i) =>
      addDays(currentDate, i),
    );
  }, [currentDate]);

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    onEventSelect(event);
  };

  // Check if there are any days with events
  const hasEvents = days.some(
    (day) => getAgendaEventsForDay(events, day).length > 0,
  );

  return (
    <div className="border-border/70 border-t px-4">
      {isLoading ? (
        <div className="my-12 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <EventSkeleton key={i} />
          ))}
        </div>
      ) : !hasEvents ? (
        <div className="flex min-h-[70svh] flex-col items-center justify-center py-16 text-center">
          <CalendarDays className="mb-2 text-muted-foreground/50" size={32} />
          <h3 className="font-medium text-lg">No events found</h3>
          <p className="text-muted-foreground">
            There are no events scheduled for this time period.
          </p>
        </div>
      ) : (
        days.map((day) => {
          const dayEvents = getAgendaEventsForDay(events, day);

          if (dayEvents.length === 0) return null;

          return (
            <div
              className="relative my-12 border-border/70 border-t"
              key={day.toISOString()}
            >
              <span
                className="-top-3 absolute left-0 flex h-6 items-center bg-background pe-4 text-[10px] uppercase data-today:font-medium sm:pe-4 sm:text-xs"
                data-today={isSameDay(day, new Date()) || undefined}
              >
                {format(day, "d MMM, EEEE")}
              </span>
              <div className="mt-6 space-y-2">
                {dayEvents.map((event) => (
                  <EventItem
                    event={event}
                    key={event.id}
                    onClick={(e) => handleEventClick(event, e)}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
