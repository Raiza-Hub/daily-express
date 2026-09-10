"use client";

import { useBodyScrollLock } from "@repo/ui/hooks/use-body-scroll-lock";
import { useCalendarState } from "@repo/ui/hooks/use-calendar";
import { useClickOutside } from "@repo/ui/hooks/use-click-outside";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useState } from "react";
import { formatLocalDate, parseLocalDate } from "~/lib/utils";
import DepartureDateField from "../DepartureDateField";
import FromLocationField from "../FromLocationField";
import MobileCalendarSheet from "../MobileCalendarSheet";
import { searchParams } from "~/lib/type";

const TripSearchBar = ({
  className,
  initialOrigin,
  initialDate,
}: {
  className?: string;
  initialOrigin?: string | null;
  initialDate?: string | null;
}) => {
  const [query] = useQueryStates(
    {
      origin: searchParams.origin,
      date: searchParams.date,
    },
    {
      history: "replace",
    },
  );
  const [origin, setOrigin] = useState(() => initialOrigin ?? "");
  const calendar = useCalendarState(
    parseLocalDate(initialDate ?? query.date ?? formatLocalDate(new Date())),
  );

  useClickOutside([calendar.desktopRef, calendar.mobileRef], () => {
    calendar.close();
  });

  useBodyScrollLock(calendar.isOpen);

  const isSearchReady = Boolean(origin);

  const router = useRouter();

  const handleSearch = () => {
    if (!origin) {
      return;
    }

    router.push(`/routes?origin=${origin}&date=${formatLocalDate(calendar.date)}`);
  };

  return (
    <div className={cn("w-full relative", className)}>
      <div className="flex flex-col lg:flex-row items-stretch gap-2">
        <FromLocationField
          id="search-from"
          value={origin}
          onChange={setOrigin}
        />

        <DepartureDateField
          value={calendar.date}
          isOpen={calendar.isOpen}
          onToggle={calendar.toggle}
          onSelect={calendar.select}
          desktopRef={calendar.desktopRef}
        />

        <button
          type="button"
          className={cn(
            "bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 lg:py-0 rounded-2xl gap-2 font-medium cursor-pointer",
            !isSearchReady && "opacity-60",
          )}
          disabled={!isSearchReady}
          onClick={handleSearch}
        >
          Search
        </button>
      </div>

      <AnimatePresence>
        {calendar.isOpen ? (
          <MobileCalendarSheet
            value={calendar.date}
            mobileRef={calendar.mobileRef}
            onClose={calendar.close}
            onSelect={calendar.select}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default TripSearchBar;
