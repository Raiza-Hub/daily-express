"use client";

import dayjs from "dayjs";
import { useMemo } from "react";

import type { CalendarEvent } from "@/components/event-calendar/types";
import { getEventColorClasses } from "@/components/event-calendar/utils";
import { cn } from "@repo/ui/lib/utils";

// Using dayjs format with custom formatting:
// 'h' - hours (1-12)
// 'a' - am/pm
// ':mm' - minutes with leading zero (only if the token 'mm' is present)
const formatTimeWithOptionalMinutes = (date: Date) => {
  return dayjs(date).minute() === 0 ? dayjs(date).format("ha") : dayjs(date).format("h:mma");
};

interface EventItemProps {
  event: CalendarEvent;
  onClick?: (e: React.MouseEvent) => void;
}

export function EventItem({ event, onClick }: EventItemProps) {
  const displayStart = useMemo(() => new Date(event.start), [event.start]);
  const displayEnd = useMemo(() => new Date(event.end), [event.end]);

  const isEventInPast = dayjs(displayEnd).isBefore(dayjs());

  return (
    <button
      className={cn(
        "flex w-full flex-col gap-1 rounded p-2 text-left outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-past-event:line-through data-past-event:opacity-90",
        getEventColorClasses(event.color),
      )}
      data-past-event={isEventInPast || undefined}
      onClick={onClick}
      type="button"
    >
      <div className="font-medium text-sm">{event.title}</div>
      <div className="text-xs opacity-70">
        {event.allDay ? (
          <span>All day</span>
        ) : (
          <span className="uppercase">
            {formatTimeWithOptionalMinutes(displayStart)} -{" "}
            {formatTimeWithOptionalMinutes(displayEnd)}
          </span>
        )}
        {event.location && (
          <>
            <span className="px-1 opacity-35"> · </span>
            <span>{event.location}</span>
          </>
        )}
      </div>
      {event.description && (
        <div className="my-1 text-xs opacity-90">{event.description}</div>
      )}
    </button>
  );
}