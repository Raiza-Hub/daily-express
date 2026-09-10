"use client";

import {
  CalendarDotsIcon,
  MagnifyingGlassIcon,
  MapPinAreaIcon,
} from "@phosphor-icons/react";
import { useBodyScrollLock } from "@repo/ui/hooks/use-body-scroll-lock";
import { useCalendarState } from "@repo/ui/hooks/use-calendar";
import { useClickOutside } from "@repo/ui/hooks/use-click-outside";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { formatLocalDate, parseLocalDate } from "~/lib/utils";
import DepartureDateField from "../DepartureDateField";
import FromLocationField from "../FromLocationField";
import MobileCalendarSheet from "../MobileCalendarSheet";

const SearchBar = ({
  initialOrigin,
  initialDate,
  disabled = false,
}: {
  initialOrigin?: string | null;
  initialDate?: string | null;
  disabled?: boolean;
}) => {
  const [origin, setOrigin] = useState(() => initialOrigin ?? "");
  const calendar = useCalendarState(
    parseLocalDate(initialDate ?? formatLocalDate(new Date())),
  );
  const router = useRouter();

  useClickOutside([calendar.desktopRef, calendar.mobileRef], () => {
    calendar.close();
  });

  useBodyScrollLock(calendar.isOpen);

  const selectDate = (date: Date) => {
    calendar.select(date);
  };

  const handleSearch = () => {
    if (!origin) {
      return;
    }

    router.push(`/routes?origin=${origin}&date=${formatLocalDate(calendar.date)}`);
  };

  return (
    <>
      <div
        className={cn(
          "flex items-stretch border border-neutral-200 rounded-2xl bg-white",
          disabled && "pointer-events-none opacity-60",
        )}
        aria-disabled={disabled}
      >
        <FromLocationField
          id="search-origin"
          value={origin}
          onChange={setOrigin}
          hideLabel
          icon={<MapPinAreaIcon className="size-5" weight="duotone" />}
        />

        <div className="w-px bg-neutral-200 self-stretch" aria-hidden="true" />

        <DepartureDateField
          value={calendar.date}
          isOpen={calendar.isOpen}
          onToggle={calendar.toggle}
          onSelect={selectDate}
          desktopRef={calendar.desktopRef}
          hideLabel
          icon={<CalendarDotsIcon className="size-5" weight="duotone" />}
        />

        <div className="w-px bg-neutral-200 self-stretch" aria-hidden="true" />

        <button
          type="button"
          disabled={!origin || disabled}
          onClick={handleSearch}
          aria-label="Search routes"
          className="flex shrink-0 items-center justify-center px-5 bg-blue-600 hover:bg-blue-700 text-white transition-colors rounded-r-2xl disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          <MagnifyingGlassIcon className="size-5" weight="bold" />
        </button>
      </div>

      <AnimatePresence>
        {calendar.isOpen ? (
          <MobileCalendarSheet
            value={calendar.date}
            mobileRef={calendar.mobileRef}
            onClose={calendar.close}
            onSelect={selectDate}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
};

export default SearchBar;