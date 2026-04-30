"use client";

import { ArrowsLeftRightIcon } from "@phosphor-icons/react";
import { useBodyScrollLock } from "@repo/ui/hooks/use-body-scroll-lock";
import { useCalendarState } from "@repo/ui/hooks/use-calendar";
import { useClickOutside } from "@repo/ui/hooks/use-click-outside";
import { useLocationField } from "@repo/ui/hooks/use-location-field";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence } from "framer-motion";
import { useQueryStates } from "nuqs";
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
  const fromField = useLocationField(query.from ?? "");
  const toField = useLocationField(query.to ?? "");
  const calendar = useCalendarState(
    parseLocalDate(query.date ?? formatLocalDate(new Date())),
  );

  useClickOutside([fromField.ref, toField.ref], () => {
    fromField.close();
    toField.close();
  });

  useClickOutside([calendar.desktopRef, calendar.mobileRef], () => {
    calendar.close();
  });

  useBodyScrollLock(calendar.isOpen);

  const isSearchReady = Boolean(fromField.query && toField.query);

  const handleSearch = () => {
    if (!fromField.query || !toField.query) {
      return;
    }

    setQuery({
      from: fromField.query,
      to: toField.query,
      date: formatLocalDate(calendar.date),
    });
  };

  return (
    <div className={cn("w-full relative", className)}>
      <div className="flex flex-col lg:flex-row items-stretch gap-2">
        <SearchLocationField
          id="search-from"
          label="From"
          value={fromField.query}
          fieldState={fromField}
          otherField={toField}
        />

        <button
          type="button"
          onClick={() => {
            const nextFrom = toField.query;
            const nextTo = fromField.query;

            fromField.setQuery(nextFrom);
            toField.setQuery(nextTo);
          }}
          className="self-center p-2 rounded-full border border-neutral-200 hover:bg-neutral-50 cursor-pointer transition-transform duration-400"
        >
          <ArrowsLeftRightIcon size={18} className="rotate-90 lg:rotate-0" />
        </button>

        <SearchLocationField
          id="search-to"
          label="To"
          value={toField.query}
          fieldState={toField}
          otherField={fromField}
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
            "bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 lg:py-0 rounded-2xl gap-2 font-medium",
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
