"use client";

import {
  CalendarCheckIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import dayjs from "dayjs";
import { useState } from "react";

import { toast } from "@repo/ui/components/sonner";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import {
  AgendaDaysToShow,
} from "@/components/event-calendar/constants";
import { AgendaView } from "@/components/event-calendar/agenda-view";
import type { CalendarEvent } from "@/components/event-calendar/types";
import { EventDialog } from "@/components/event-calendar/event-dialog";

export interface EventCalendarProps {
  events?: CalendarEvent[];
  onEventAdd?: (event: CalendarEvent) => void;
  onEventUpdate?: (event: CalendarEvent) => void;
  onEventDelete?: (eventId: string) => void;
  className?: string;
}

export function EventCalendar({
  events = [],
  onEventAdd,
  onEventUpdate,
  onEventDelete,
  className,
}: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );

  const handlePrevious = () => {
    setCurrentDate(
      dayjs(currentDate).subtract(AgendaDaysToShow, "day").toDate(),
    );
  };

  const handleNext = () => {
    setCurrentDate(dayjs(currentDate).add(AgendaDaysToShow, "day").toDate());
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleEventSelect = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventDialogOpen(true);
  };

  const handleEventSave = (event: CalendarEvent) => {
    if (event.id) {
      onEventUpdate?.(event);
      toast(`Event "${event.title}" updated`, {
        description: dayjs(event.start).format("MMM D, YYYY"),
        position: "bottom-left",
      });
    } else {
      onEventAdd?.({
        ...event,
        id: Math.random().toString(36).substring(2, 11),
      });
      toast(`Event "${event.title}" added`, {
        description: dayjs(event.start).format("MMM D, YYYY"),
        position: "bottom-left",
      });
    }
    setIsEventDialogOpen(false);
    setSelectedEvent(null);
  };

  const handleEventDelete = (eventId: string) => {
    const deletedEvent = events.find((e) => e.id === eventId);
    onEventDelete?.(eventId);
    setIsEventDialogOpen(false);
    setSelectedEvent(null);

    if (deletedEvent) {
      toast(`Event "${deletedEvent.title}" deleted`, {
        description: dayjs(deletedEvent.start).format("MMM D, YYYY"),
        position: "bottom-left",
      });
    }
  };

  // Show the month range for agenda view
  const viewStart = dayjs(currentDate);
  const viewEnd = dayjs(currentDate).add(AgendaDaysToShow - 1, "day");
  const viewTitle =
    viewStart.isSame(viewEnd, "month")
      ? viewStart.format("MMMM YYYY")
      : `${viewStart.format("MMM")} - ${viewEnd.format("MMM YYYY")}`;

  return (
    <div className="flex flex-col rounded-lg border">
      <div
        className={cn(
          "relative flex items-center justify-between p-2 sm:p-4",
          className,
        )}
      >
        <Button onClick={handleToday} variant="outline">
          <CalendarCheckIcon
            aria-hidden="true"
            className="min-[480px]:hidden"
            size={16}
          />
          <span className="max-[479px]:sr-only">Today</span>
        </Button>

        <h2 className="pointer-events-none absolute left-1/2 max-w-[50%] -translate-x-1/2 truncate font-semibold text-muted-foreground text-sm">
          {viewTitle}
        </h2>

        <div className="flex items-center sm:gap-2">
          <Button
            aria-label="Previous"
            onClick={handlePrevious}
            size="icon"
            variant="ghost"
          >
            <CaretLeftIcon aria-hidden="true" size={16} />
          </Button>
          <Button
            aria-label="Next"
            onClick={handleNext}
            size="icon"
            variant="ghost"
          >
            <CaretRightIcon aria-hidden="true" size={16} />
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

      <EventDialog
        event={selectedEvent}
        isOpen={isEventDialogOpen}
        onClose={() => {
          setIsEventDialogOpen(false);
          setSelectedEvent(null);
        }}
        onDelete={handleEventDelete}
        onSave={handleEventSave}
      />
    </div>
  );
}