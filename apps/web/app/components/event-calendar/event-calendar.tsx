"use client";

import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format, isSameMonth, subDays } from "date-fns";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

import { AgendaDaysToShow } from "~/components/event-calendar/constants";
import { AgendaView } from "~/components/event-calendar/agenda-view";
import { EventDrawer } from "~/components/event-calendar/event-drawer";
import type { CalendarEvent } from "~/components/event-calendar/types";

export interface EventCalendarProps {
  events?: CalendarEvent[];
  onEventDelete?: (eventId: string) => void;
  className?: string;
}

export function EventCalendar({
  events = [],
  onEventDelete,
  className,
}: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEventDrawerOpen, setIsEventDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const handlePrevious = () => {
    setCurrentDate(subDays(currentDate, AgendaDaysToShow));
  };

  const handleNext = () => {
    setCurrentDate(addDays(currentDate, AgendaDaysToShow));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleEventSelect = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventDrawerOpen(true);
  };

  const handleEventDelete = (eventId: string) => {
    onEventDelete?.(eventId);
    setIsEventDrawerOpen(false);
    setSelectedEvent(null);
  };

  // Show the month range for agenda view
  const viewStart = currentDate;
  const viewEnd = addDays(currentDate, AgendaDaysToShow - 1);
  const viewTitle = isSameMonth(viewStart, viewEnd)
    ? format(viewStart, "MMMM yyyy")
    : `${format(viewStart, "MMM")} - ${format(viewEnd, "MMM yyyy")}`;

  return (
    <div className="flex flex-col rounded-lg border">
      <div
        className={cn(
          "relative flex items-center justify-between p-2 sm:p-4",
          className,
        )}
      >
        <Button onClick={handleToday} variant="outline">
          <CalendarCheck aria-hidden="true" className="min-[480px]:hidden" size={16} />
          <span className="max-[479px]:sr-only">Today</span>
        </Button>

        <h2 className="pointer-events-none absolute left-1/2 max-w-[50%] -translate-x-1/2 truncate font-semibold text-muted-foreground text-sm">
          {viewTitle}
        </h2>

        <div className="flex items-center sm:gap-2">
          <Button
            aria-label="Previous"
            className="size-9 p-0"
            onClick={handlePrevious}
            size="sm"
            variant="secondary"
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </Button>
          <Button
            aria-label="Next"
            className="size-9 p-0"
            onClick={handleNext}
            size="sm"
            variant="secondary"
          >
            <ChevronRight aria-hidden="true" size={16} />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <AgendaView
          currentDate={currentDate}
          events={events}
          onEventSelect={handleEventSelect}
        />
      </div>

      <EventDrawer
        event={selectedEvent}
        isOpen={isEventDrawerOpen}
        onClose={() => {
          setIsEventDrawerOpen(false);
          setSelectedEvent(null);
        }}
        onDelete={handleEventDelete}
      />
    </div>
  );
}
