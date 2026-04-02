"use client";

import dayjs from "dayjs";
import { cn } from "@repo/ui/lib/utils";
import { ArrowsLeftRightIcon } from "@phosphor-icons/react";
import { CalendarTwin } from "../CalendarTwin";
import { LocationDropdown } from "@repo/ui/components/location-dropdown";
import type { LocationSuggestion } from "@repo/ui/components/location-dropdown";
import { suggestLocations } from "@repo/ui/lib/location";
import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDebouncedCallback } from "@repo/ui/hooks/use-debounced-callback";
import { useClickOutside } from "@repo/ui/hooks/use-click-outside";
import { useBodyScrollLock } from "@repo/ui/hooks/use-body-scroll-lock";
import { Input } from "@repo/ui/components/input";
import { useQueryState, useQueryStates } from "nuqs";
import { searchParams } from "../../search-params";
import { formatLocalDate, parseLocalDate } from "~/lib/trip-search";

export function TripSearchBar({ className }: { className?: string }) {
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
  const [vehicleType] = useQueryState(
    "vehicleType",
    searchParams.vehicleType.withOptions({ history: "replace" }),
  );
  const [todayDate] = useState(() => formatLocalDate(new Date()));

  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [departureDate, setDepartureDateState] = useState(() =>
    parseLocalDate(todayDate),
  );

  const setDepartureDate = (newDate: Date) => {
    setDepartureDateState(newDate);
  };
  const [showCalendar, setShowCalendar] = useState(false);

  /* -------------------------------------------------- */
  /* FROM (departure) state                              */
  /* -------------------------------------------------- */
  const [fromSuggestions, setFromSuggestions] = useState<LocationSuggestion[]>(
    [],
  );
  const [isFromLoading, setIsFromLoading] = useState(false);
  const [showFromDropdown, setShowFromDropdown] = useState(false);

  /* -------------------------------------------------- */
  /* TO (arrival) state                                  */
  /* -------------------------------------------------- */
  const [toSuggestions, setToSuggestions] = useState<LocationSuggestion[]>([]);
  const [isToLoading, setIsToLoading] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const mobileCalendarRef = useRef<HTMLDivElement>(null);

  /* -------------------------------------------------- */
  /* DEBOUNCED SEARCH                                    */
  /* -------------------------------------------------- */
  const fetchFromSuggestions = useDebouncedCallback(async (query: string) => {
    const res = await suggestLocations(query);
    setFromSuggestions(res);
    setIsFromLoading(false);
  }, 400);

  const fetchToSuggestions = useDebouncedCallback(async (query: string) => {
    const res = await suggestLocations(query);
    setToSuggestions(res);
    setIsToLoading(false);
  }, 400);

  /* -------------------------------------------------- */
  /* CLOSE DROPDOWNS ON OUTSIDE CLICK                   */
  /* -------------------------------------------------- */
  useClickOutside([fromRef, toRef], () => {
    setShowFromDropdown(false);
    setShowToDropdown(false);
  });

  useClickOutside([calendarRef, mobileCalendarRef], () => {
    setShowCalendar(false);
  });

  useBodyScrollLock(showCalendar);

  const isSearchReady = Boolean(fromQuery && toQuery);

  const handleSearch = () => {
    if (!fromQuery || !toQuery) {
      return;
    }

    void setQuery({
      from: fromQuery,
      to: toQuery,
      date: formatLocalDate(departureDate),
    });
  };

  return (
    <div className={cn("w-full relative", className)}>
      <div className="flex flex-col lg:flex-row items-stretch gap-2">
        {/* FROM */}
        <div
          ref={fromRef}
          className="relative flex-auto bg-white border border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center focus-within:ring-2 focus-within:ring-blue-500 transition"
        >
          <label htmlFor="search-from" className="text-xs text-neutral-400">
            From
          </label>

          <Input
            id="search-from"
            value={fromQuery}
            placeholder="City or airport"
            autoComplete="off"
            className="border-0 p-0 h-auto text-sm font-medium bg-transparent shadow-none focus-visible:ring-0 rounded-none"
            onFocus={() => {
              if (fromQuery.length > 1) setShowFromDropdown(true);
              setShowToDropdown(false);
            }}
            onChange={(e) => {
              const value = e.target.value;
              setFromQuery(value);
              setShowToDropdown(false);
              setShowFromDropdown(true);

              if (value.length > 1) {
                setIsFromLoading(true);
                fetchFromSuggestions(value);
              } else {
                fetchFromSuggestions.cancel();
                setFromSuggestions([]);
                setIsFromLoading(false);
                setShowFromDropdown(false);
              }
            }}
          />

          <LocationDropdown
            visible={showFromDropdown}
            suggestions={fromSuggestions}
            isLoading={isFromLoading}
            query={fromQuery}
            onSelect={async (loc) => {
              setFromQuery(loc.title);
              setShowFromDropdown(false);
            }}
          />
        </div>

        {/* SWAP */}
        <button
          type="button"
          onClick={() => {
            const nextFrom = toQuery;
            const nextTo = fromQuery;

            setFromQuery(nextFrom);
            setToQuery(nextTo);
          }}
          className="self-center p-2 rounded-full border border-neutral-200 hover:bg-neutral-50 cursor-pointer transition-transform duration-400"
        >
          <ArrowsLeftRightIcon size={18} className="rotate-90 lg:rotate-0" />
        </button>

        {/* TO */}
        <div
          ref={toRef}
          className="relative flex-auto bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center focus-within:ring-2 focus-within:ring-blue-500 transition"
        >
          <label htmlFor="search-to" className="text-xs text-neutral-400">
            To
          </label>

          <Input
            id="search-to"
            value={toQuery}
            placeholder="City or airport"
            autoComplete="off"
            className="border-0 p-0 h-auto text-sm font-medium bg-transparent shadow-none focus-visible:ring-0 rounded-none"
            onFocus={() => {
              if (toQuery.length > 1) setShowToDropdown(true);
              setShowFromDropdown(false);
            }}
            onChange={(e) => {
              const value = e.target.value;
              setToQuery(value);
              setShowFromDropdown(false);
              setShowToDropdown(true);

              if (value.length > 1) {
                setIsToLoading(true);
                fetchToSuggestions(value);
              } else {
                fetchToSuggestions.cancel();
                setToSuggestions([]);
                setIsToLoading(false);
                setShowToDropdown(false);
              }
            }}
          />

          <LocationDropdown
            visible={showToDropdown}
            suggestions={toSuggestions}
            isLoading={isToLoading}
            query={toQuery}
            onSelect={async (loc) => {
              setToQuery(loc.title);
              setShowToDropdown(false);
            }}
          />
        </div>

        {/* DEPARTURE DATE */}
        <div
          ref={calendarRef}
          className="relative flex-[1.5] bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center focus-within:ring-2 focus-within:ring-blue-500 transition"
        >
          <button
            type="button"
            onClick={() => setShowCalendar((prev) => !prev)}
            className="w-full text-left outline-none cursor-pointer"
          >
            <span className="text-xs text-neutral-400 block">Departure</span>
            <span className="text-sm font-medium text-neutral-900">
              {dayjs(departureDate).format("DD MMM YYYY")}
            </span>
          </button>

          {showCalendar && (
            <div className="absolute top-full right-0 mt-2 z-50 min-w-[600px]">
              <CalendarTwin
                value={departureDate}
                onChange={(date) => {
                  setDepartureDate(date);
                  setShowCalendar(false);
                }}
                className="shadow-lg"
              />
            </div>
          )}
        </div>

        {/* SEARCH BUTTON */}
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

      {/* MOBILE CALENDAR — bottom sheet */}
      <AnimatePresence>
        {showCalendar && (
          <div
            ref={mobileCalendarRef}
            className="md:hidden fixed inset-0 z-50 flex flex-col"
          >
            {/* Backdrop */}
            <motion.div
              key="calendar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="absolute inset-0 bg-black/40"
              onClick={() => setShowCalendar(false)}
            />

            {/* Sheet */}
            <motion.div
              key="calendar-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative mt-auto bg-white rounded-t-2xl p-4 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-neutral-900">
                  Select departure date
                </span>
                <button
                  type="button"
                  onClick={() => setShowCalendar(false)}
                  className="text-sm text-neutral-500 hover:text-neutral-800 transition cursor-pointer"
                >
                  Close
                </button>
              </div>

              <CalendarTwin
                value={departureDate}
                onChange={(date) => {
                  setDepartureDate(date);
                  setShowCalendar(false);
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
