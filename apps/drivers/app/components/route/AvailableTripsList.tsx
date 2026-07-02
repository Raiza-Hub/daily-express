"use client";

import { CalendarSlashIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useGetAvailableTripsCountByDate, useGetAvailableTripsInfinite } from "@repo/api";
import { Button } from "@repo/ui/components/button";
import DriverCalendar from "@repo/ui/components/driver-calendar";
import { Input } from "@repo/ui/components/input";
import { useDebouncedCallback } from "@repo/ui/hooks/use-debounced-callback";
import dayjs from "dayjs";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { useStreamLiveTrips } from "~/hooks/useStreamLiveTrips";
import Loader from "../Loader";
import ClaimTripCardItem from "./ClaimTripCardItem";

export default function AvailableTripsList() {
  useStreamLiveTrips();

  const today = dayjs().format("YYYY-MM-DD");

  const [selectedDate, setSelectedDate] = useQueryState(
    "date",
    parseAsString.withDefault(today).withOptions({ history: "replace" }),
  );
  const [activeSearch, setActiveSearch] = useQueryState(
    "search",
    parseAsString.withOptions({ history: "replace" }),
  );

  const [searchInput, setSearchInput] = useState(() => activeSearch ?? "");

  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setActiveSearch(value || null);
  }, 400);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGetAvailableTripsInfinite({
    date: selectedDate,
    search: activeSearch || undefined,
  });

  const trips = data?.pages.flatMap((page) => page.trips) ?? [];

  const calStart = dayjs().format("YYYY-MM-DD");
  const calEnd = dayjs().add(60, "day").format("YYYY-MM-DD");
  const { data: countData } = useGetAvailableTripsCountByDate(calStart, calEnd);
  const counts = countData?.counts ?? {};

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSetSearch(value);
  };

  const handleDateSelect = (d: Date | undefined) => {
    if (!d) return;
    setSelectedDate(dayjs(d).format("YYYY-MM-DD"));
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="flex flex-col gap-1 mb-6 py-4 border-b border-gray-100">
        <h1 className="text-xl font-semibold">Available Trips</h1>
        <p className="text-sm text-muted-foreground">
          Trips for <span className="font-medium">{dayjs(selectedDate).format("MMMM D, YYYY")}</span>
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
        <div className="relative w-full">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by pickup or dropoff location..."
            value={searchInput}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>

        <DriverCalendar
          counts={counts}
          onDateSelect={handleDateSelect}
        />
      </div>

      {isLoading ? (
        <div className="w-full max-w-3xl mx-auto flex items-center justify-center py-20">
          <Loader text="Fetching available trips..." />
        </div>
      ) : isError ? (
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-4 py-20">
          <p className="text-red-500 text-sm">
            {error instanceof Error ? error.message : "Failed to load available trips"}
          </p>
        </div>
      ) : trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <CalendarSlashIcon className="size-8 text-neutral-400" />
          <p className="text-muted-foreground text-sm">
            {activeSearch
              ? "No trips match your search."
              : "No trips available for this date."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map((trip) => (
              <ClaimTripCardItem
                key={trip.tripId}
                trip={trip}
                onClaimSuccess={refetch}
              />
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center py-8">
              <Button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-medium disabled:opacity-60"
              >
                {isFetchingNextPage ? "Loading more..." : "Load More"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}