"use client";

import type { TripsSummaryRange } from "@repo/api";
import dayjs from "dayjs";
import { useMemo } from "react";
import { RouteWithTrips } from "~/lib/type";
import { combineTripDateAndTime } from "~/lib/utils";
import RouteCardItem from "./RouteCardItem";
import { CalendarSlashIcon } from "@phosphor-icons/react";

interface RouteCardProps {
  selectedDate?: dayjs.Dayjs;
  tripsSummaryRange?: TripsSummaryRange[];
  isLoading?: boolean;
}


export default function RouteCard({
  selectedDate,
  tripsSummaryRange,
  isLoading = false,
}: RouteCardProps) {
  const activeDate = selectedDate || dayjs();
  const selectedDateStr = activeDate.format("YYYY-MM-DD");

  const routes: RouteWithTrips[] = useMemo(() => {
    if (!tripsSummaryRange || !Array.isArray(tripsSummaryRange)) {
      return [];
    }

    const selectedDaySummary = tripsSummaryRange.find((summary) => {
      const summaryDate = summary.date?.split("T")[0] ?? summary.date;
      return summaryDate === selectedDateStr;
    });

    if (!selectedDaySummary) {
      return [];
    }

    return selectedDaySummary.trips.map((trip) => {
      const tripDate = new Date(trip.date);
      const departureDateTime = combineTripDateAndTime(
        tripDate,
        trip.route.departure_time,
      );
      let arrivalDateTime = combineTripDateAndTime(
        tripDate,
        trip.route.arrival_time,
      );

      if (arrivalDateTime <= departureDateTime) {
        arrivalDateTime = dayjs(arrivalDateTime).add(1, "day").toDate();
      }

      return {
        id: trip.id,
        tripId: trip.id,
        departureTime: dayjs(departureDateTime).format("h:mma"),
        departureCode: trip.route.pickup_location_title,
        arrivalTime: dayjs(arrivalDateTime).format("h:mma"),
        arrivalCode: trip.route.dropoff_location_title,
        bookedSeats: trip.bookedSeats,
        capacity: trip.capacity,
        departureCity: {
          title: trip.route.pickup_location_title,
          locality: trip.route.pickup_location_locality,
        },
        arrivalCity: {
          title: trip.route.dropoff_location_title,
          locality: trip.route.dropoff_location_locality,
        },
      };
    });
  }, [selectedDateStr, tripsSummaryRange]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="animate-pulse h-32 bg-gray-200 rounded-xl" />
        <div className="animate-pulse h-32 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <CalendarSlashIcon className="w-6 h-6 text-neutral-500" />
        <p className="text-muted-foreground">No trips available for this date</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {routes.map((route) => (
        <RouteCardItem
          key={route.id}
          route={route}
          // onPassengers={() => console.log("passengers")}
        />
      ))}
    </div>
  );
}
