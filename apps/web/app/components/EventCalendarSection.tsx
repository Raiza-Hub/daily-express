"use client";

import { addDays, setHours, startOfDay } from "date-fns";
import { useMemo, useState } from "react";

import {
  EventCalendar,
  type CalendarEvent,
  type EventCalendarPassenger,
} from "~/components/event-calendar";

const passenger = (
  id: string,
  fullName: string,
  phone: string,
  carriesLuggage = false,
): EventCalendarPassenger => ({ id, fullName, phone, carriesLuggage });

const buildSampleEvents = (): CalendarEvent[] => {
  const today = startOfDay(new Date());

  return [
    {
      id: "sample-1",
      origin: "Federal University of Agriculture, Abeokuta.",
      destination: "Professor Wole Soyinka Station Abeokuta",
      start: setHours(addDays(today, 1), 9),
      end: setHours(addDays(today, 1), 9.5),
      status: "pending_payment",
      price: 3000,
      passengers: [
        passenger("s1-p1", "Adaeze Okafor", "2348012345678"),
        passenger("s1-p2", "Bola Adewale", "2348123456789"),
        passenger("s1-p3", "Chika Obi", "2348234567890"),
        passenger("s1-p4", "Damilola Fashola", "2348345678901"),
      ],
    },
    {
      id: "sample-2",
      origin: "Federal University of Agriculture, Abeokuta.",
      destination: "Lagos Central Business District",
      start: setHours(addDays(today, 2), 11),
      end: setHours(addDays(today, 2), 12),
      status: "pending_payment",
      price: 4500,
      passengers: [
        passenger("s2-p1", "Chinedu Nwosu", "2348023456789", true),
        passenger("s2-p2", "Folake Adeyemi", "2348034567890"),
        passenger("s2-p3", "Gideon Okoye", "2348456789012"),
        passenger("s2-p4", "Halima Bello", "2348567890123"),
      ],
    },
    {
      id: "sample-3",
      origin: "Professor Wole Soyinka Station Abeokuta",
      destination: "Federal University of Agriculture, Abeokuta.",
      start: setHours(addDays(today, 3), 8),
      end: setHours(addDays(today, 3), 9),
      status: "paid",
      price: 2500,
      passengers: [
        passenger("s3-p1", "Ibrahim Musa", "2348045678901"),
        passenger("s3-p2", "Ngozi Eze", "2348056789012", true),
        passenger("s3-p3", "Segun Balogun", "2348067890123"),
        passenger("s3-p4", "Toyin Adebayo", "2348678901234"),
      ],
    },
    {
      id: "sample-4",
      origin: "Lagos Central Business District",
      destination: "Federal University of Agriculture, Abeokuta.",
      start: setHours(addDays(today, 6), 14),
      end: setHours(addDays(today, 6), 15),
      status: "paid",
      price: 6000,
      passengers: [
        passenger("s4-p1", "Amaka Obi", "2348078901234", true),
        passenger("s4-p2", "Tunde Bakare", "2348089012345"),
        passenger("s4-p3", "Uche Nnamdi", "2348789012345"),
        passenger("s4-p4", "Victoria Eze", "2348890123456"),
      ],
    },
    {
      id: "sample-5",
      origin: "Federal University of Agriculture, Abeokuta.",
      destination: "Professor Wole Soyinka Station Abeokuta",
      start: setHours(addDays(today, 10), 10),
      end: setHours(addDays(today, 10), 12),
      status: "cancelled",
      price: 5000,
      passengers: [
        passenger("s5-p1", "Hauwa Sani", "2348090123456"),
        passenger("s5-p2", "Yemi Odugbesan", "2348901234567"),
        passenger("s5-p3", "Zainab Abubakar", "2349012345678"),
        passenger("s5-p4", "Chiamaka Obi", "2349123456789"),
      ],
    },
  ];
};

export function EventCalendarSection() {
  const [events, setEvents] = useState<CalendarEvent[]>(() =>
    buildSampleEvents(),
  );

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [events],
  );

  const handleEventDelete = (eventId: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== eventId));
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

      <EventCalendar events={sortedEvents} onEventDelete={handleEventDelete} />
    </div>
  );
}
