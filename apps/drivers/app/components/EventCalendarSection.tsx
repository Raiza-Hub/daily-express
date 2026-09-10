"use client";

import dayjs from "dayjs";
import { useMemo, useState } from "react";

import {
  EventCalendar,
  type CalendarEvent,
} from "@/components/event-calendar";

const buildSampleEvents = (): CalendarEvent[] => {
  const today = dayjs().startOf("day");

  return [
    {
      id: "sample-1",
      title: "Route briefing",
      description: "Morning briefing before the first trip.",
      start: today.add(1, "day").hour(9).minute(0).toDate(),
      end: today.add(1, "day").hour(9).minute(30).toDate(),
      allDay: false,
      color: "sky",
      location: "Dispatch office",
    },
    {
      id: "sample-2",
      title: "Vehicle inspection",
      description: "Scheduled maintenance check.",
      start: today.add(2, "day").hour(11).minute(0).toDate(),
      end: today.add(2, "day").hour(12).minute(0).toDate(),
      allDay: false,
      color: "amber",
      location: "Garage B",
    },
    {
      id: "sample-3",
      title: "Fuel top-up day",
      description: "Fuel discount applies for the whole day.",
      start: today.add(3, "day").hour(0).minute(0).toDate(),
      end: today.add(3, "day").hour(23).minute(59).toDate(),
      allDay: true,
      color: "emerald",
    },
    {
      id: "sample-4",
      title: "Customer appreciation",
      description: "Thank-your-regulars initiative kickoff.",
      start: today.add(6, "day").hour(14).minute(0).toDate(),
      end: today.add(6, "day").hour(15).minute(0).toDate(),
      allDay: false,
      color: "rose",
      location: "Downtown terminal",
    },
    {
      id: "sample-5",
      title: "Driver training",
      description: "Refresher on safety procedures.",
      start: today.add(10, "day").hour(10).minute(0).toDate(),
      end: today.add(10, "day").hour(12).minute(0).toDate(),
      allDay: false,
      color: "violet",
      location: "Training center",
    },
  ];
};

export function EventCalendarSection() {
  const [events, setEvents] = useState<CalendarEvent[]>(() =>
    buildSampleEvents(),
  );

  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf(),
      ),
    [events],
  );

  const handleEventAdd = (event: CalendarEvent) => {
    setEvents((prev) => [...prev, event]);
  };

  const handleEventUpdate = (updatedEvent: CalendarEvent) => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event,
      ),
    );
  };

  const handleEventDelete = (eventId: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== eventId));
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Available trips
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Claim open trips and manage the ones assigned to you.
        </p>
      </div>

      <EventCalendar
        events={sortedEvents}
        onEventAdd={handleEventAdd}
        onEventDelete={handleEventDelete}
        onEventUpdate={handleEventUpdate}
      />
    </div>
  );
}
