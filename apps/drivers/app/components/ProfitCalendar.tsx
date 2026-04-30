"use client";

import { useState, useMemo, type FC } from "react";
import dayjs, { Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import { cn, formatPrice } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
import type { TripsSummaryRange } from "@repo/api";

dayjs.extend(isoWeek);

interface ProfitCalendarProps {
  viewDate?: Dayjs;
  onViewDateChange?: (date: Dayjs) => void;
  selectedDate?: Dayjs;
  onSelectedDateChange?: (date: Dayjs) => void;
  tripsSummaryRange?: TripsSummaryRange[];
  isLoading?: boolean;
}

export const ProfitCalendar: FC<ProfitCalendarProps> = ({
  viewDate: externalViewDate,
  onViewDateChange,
  selectedDate: externalSelectedDate,
  onSelectedDateChange,
  tripsSummaryRange,
  isLoading = false,
}) => {
  const [internalViewDate, setInternalViewDate] = useState(() => dayjs());

  // Use external state if provided, otherwise use internal state
  const viewDate = externalViewDate || internalViewDate;
  const setViewDate = onViewDateChange
    ? (date: Dayjs) => onViewDateChange(date)
    : setInternalViewDate;

  const [internalSelectedDate, setInternalSelectedDate] =
 useState(() => dayjs());

  // Use external selectedDate if provided, otherwise use internal state
  const selectedDate = externalSelectedDate || internalSelectedDate;
  const setSelectedDate = onSelectedDateChange
    ? (date: Dayjs) => onSelectedDateChange(date)
    : setInternalSelectedDate;

  const visibleDays = useMemo(() => {
    const start = viewDate.startOf("isoWeek");
    return Array.from({ length: 7 }, (_, i) => start.add(i, "day"));
  }, [viewDate]);

  const earningsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    if (tripsSummaryRange && Array.isArray(tripsSummaryRange)) {
      for (const summary of tripsSummaryRange) {
        const dateStr = summary.date?.split("T")[0] ?? "";
        if (dateStr) {
          map[dateStr] = summary.totalEarnings ?? 0;
        }
      }
    }
    return map;
  }, [tripsSummaryRange]);

  const handlePrev = () => {
    setViewDate(viewDate.subtract(1, "week"));
  };

  const handleNext = () => {
    setViewDate(viewDate.add(1, "week"));
  };

  const headerLabel = useMemo(() => {
    return viewDate.format("MMMM YYYY");
  }, [viewDate]);

  const getAmountForDate = (date: dayjs.Dayjs): string => {
    if (isLoading) return "...";
    const dateStr = date.format("YYYY-MM-DD");
    const earnings = earningsByDate[dateStr] || 0;
    return formatPrice(earnings);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base md:text-lg font-semibold text-gray-900">
          {headerLabel}
        </h2>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            className="h-9 w-9 md:h-8 md:w-8"
          >
            <CaretLeftIcon className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            className="h-9 w-9 md:h-8 md:w-8"
          >
            <CaretRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-2xl bg-neutral-50 overflow-x-auto">
        <div className="grid grid-cols-7 divide-x divide-neutral-200 min-w-max">
          {visibleDays.map((day) => {
            const isSelected = day.isSame(selectedDate, "day");

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "relative flex flex-col items-center justify-center",
                  "px-1 py-4 md:py-5",
                  "transition-all duration-200",
                  "focus:outline-none",
                  "hover:bg-gray-100/60",
                  isSelected && "bg-white",
                )}
              >
                <span
                  className={cn(
                    "text-xs md:text-sm mb-1",
                    "text-center",
                    isSelected ? "text-blue-600" : "text-gray-500",
                  )}
                >
                  {day.format("ddd, D MMM")}
                </span>

                <span
                  className={cn(
                    "text-sm md:text-base font-medium",
                    isSelected ? "text-blue-600" : "text-gray-900",
                  )}
                >
                  {getAmountForDate(day)}
                </span>

                {isSelected && (
                  <div className="absolute bottom-0 left-4 right-4 h-[3px] bg-blue-600 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
