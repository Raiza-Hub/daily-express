"use client";

import { useMemo, useState, useCallback } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { useGetTripsSummaryRange } from "@repo/api";
import { ProfitCalendar } from "./ProfitCalendar";
import RouteCard from "./route/RouteCard";

dayjs.extend(isoWeek);

function clampDateToWeek(date: dayjs.Dayjs, weekStart: dayjs.Dayjs, weekEnd: dayjs.Dayjs) {
  if (date.isBefore(weekStart, "day")) return weekStart;
  if (date.isAfter(weekEnd, "day")) return weekStart;
  return date;
}

export function DashboardRoutes() {
  const [viewDate, setViewDate] = useState(() => dayjs());
  const [selectedDate, setSelectedDate] = useState(() => dayjs());

  const startDateStr = useMemo(
    () => viewDate.startOf("isoWeek").format("YYYY-MM-DD"),
    [viewDate],
  );
  const endDateStr = useMemo(
    () => viewDate.endOf("isoWeek").format("YYYY-MM-DD"),
    [viewDate],
  );

  const { data: tripsSummaryRange, isLoading } = useGetTripsSummaryRange(
    startDateStr,
    endDateStr,
  );

  const handleViewDateChange = useCallback((newViewDate: dayjs.Dayjs) => {
    setViewDate(newViewDate);
    setSelectedDate((prevSelected) => {
      const weekStart = newViewDate.startOf("isoWeek");
      const weekEnd = newViewDate.endOf("isoWeek");
      return clampDateToWeek(prevSelected, weekStart, weekEnd);
    });
  }, []);

  return (
    <div className="space-y-4">
      <ProfitCalendar
        viewDate={viewDate}
        onViewDateChange={handleViewDateChange}
        selectedDate={selectedDate}
        onSelectedDateChange={setSelectedDate}
        tripsSummaryRange={tripsSummaryRange}
        isLoading={isLoading}
      />
      <RouteCard
        selectedDate={selectedDate}
        tripsSummaryRange={tripsSummaryRange}
        isLoading={isLoading}
      />
    </div>
  );
}
