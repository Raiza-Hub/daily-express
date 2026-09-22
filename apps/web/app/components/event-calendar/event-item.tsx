"use client";

import { format } from "date-fns";

import type { CalendarEvent } from "~/components/event-calendar/types";
import { cn } from "@repo/ui/lib/utils";

interface EventItemProps {
  event: CalendarEvent;
  onClick?: (e: React.MouseEvent) => void;
}

export function EventItem({ event, onClick }: EventItemProps) {
  const start = new Date(event.start);
  const dateLabel = format(start, "MMM d, yyyy");
  const timeLabel = format(start, "h:mm a");

  return (
    <button
      className={cn(
        "flex w-full flex-col gap-1 rounded-2xl bg-neutral-50 p-4 text-left outline-none transition hover:bg-neutral-100 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-neutral-900 dark:hover:bg-neutral-800",
      )}
      onClick={onClick}
      type="button"
    >
      <p className="text-sm font-medium text-muted-foreground">Origin</p>
      <p className="font-semibold text-foreground">{event.origin}</p>
      <p className="mt-2 text-sm font-medium text-muted-foreground">
        Destination
      </p>
      <p className="font-semibold text-foreground">{event.destination}</p>
      <div className="my-3 h-px w-full bg-border" />
      <p className="text-sm text-muted-foreground">
        {dateLabel}
        {" \u2022 "}
        {timeLabel}
      </p>
    </button>
  );
}