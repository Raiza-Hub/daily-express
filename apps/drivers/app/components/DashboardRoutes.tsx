"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { useGetTripsSummaryRange } from "@repo/api";
import { ProfitCalendar } from "./ProfitCalendar";
import RouteCard from "./route/RouteCard";

dayjs.extend(isoWeek);

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

  useEffect(() => {
    const startOfWeek = viewDate.startOf("isoWeek");
    const endOfWeek = viewDate.endOf("isoWeek");

    if (
      selectedDate.isBefore(startOfWeek, "day") ||
      selectedDate.isAfter(endOfWeek, "day")
    ) {
      setSelectedDate(startOfWeek);
    }
  }, [selectedDate, viewDate]);

  return (
    <div className="space-y-4">
      <ProfitCalendar
        viewDate={viewDate}
        onViewDateChange={setViewDate}
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
