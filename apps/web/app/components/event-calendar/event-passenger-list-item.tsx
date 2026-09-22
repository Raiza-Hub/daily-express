"use client";

import { formatPhoneDisplay } from "~/lib/phone";

import type { EventCalendarPassenger } from "./types";

interface EventPassengerListItemProps {
  passenger: EventCalendarPassenger;
}

function EventPassengerListItem({ passenger }: EventPassengerListItemProps) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900">
          {passenger.fullName}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {formatPhoneDisplay(passenger.phone)}
        </p>
      </div>
      {passenger.carriesLuggage && (
        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
          Luggage
        </span>
      )}
    </li>
  );
}

export { EventPassengerListItem };