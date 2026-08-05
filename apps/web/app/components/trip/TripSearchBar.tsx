"use client";

import { ArrowsLeftRightIcon } from "@phosphor-icons/react";
import { useBodyScrollLock } from "@repo/ui/hooks/use-body-scroll-lock";
import { useCalendarState } from "@repo/ui/hooks/use-calendar";
import { useClickOutside } from "@repo/ui/hooks/use-click-outside";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence } from "framer-motion";
import { useQueryStates } from "nuqs";
import { useState } from "react";
import { formatLocalDate, parseLocalDate } from "~/lib/utils";
import DepartureDateField from "../DepartureDateField";
import MobileCalendarSheet from "../MobileCalendarSheet";
import SearchLocationField from "../SearchLocationField";
import { searchParams } from "~/lib/type";

const TripSearchBar = ({ className }: { className?: string }) => {
  const [query, setQuery] = useQueryStates(
    {
      from: searchParams.from,
      to: searchParams.to,
      date: searchParams.date,
    },
    {
      history: "replace",
    },
  );
  const [from, setFrom] = useState(() => query.from ?? "");
  const [to, setTo] = useState(() => query.to ?? "");
  const calendar = useCalendarState(
    parseLocalDate(query.date ?? formatLocalDate(new Date())),
  );

  useClickOutside([calendar.desktopRef, calendar.mobileRef], () => {
    calendar.close();
  });

  useBodyScrollLock(calendar.isOpen);

  const isSearchReady = Boolean(from && to);

  const handleSearch = () => {
    if (!from || !to) {
      return;
    }

    setQuery({
      from,
      to,
      date: formatLocalDate(calendar.date),
    });
  };

  return (
    <div className={cn("w-full relative", className)}>
      <div className="flex flex-col lg:flex-row items-stretch gap-2">
        <SearchLocationField
          id="search-from"
          label="From"
          value={from}
          onChange={setFrom}
        />

        <button
          type="button"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="bg-white self-center p-2 rounded-full border border-neutral-200 hover:bg-neutral-50 cursor-pointer transition-transform duration-400"
        >
          <ArrowsLeftRightIcon size={18} className="rotate-90 lg:rotate-0" />
        </button>

        <SearchLocationField
          id="search-to"
          label="To"
          value={to}
          onChange={setTo}
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
