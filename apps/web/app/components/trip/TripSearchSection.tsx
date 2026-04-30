"use client";

import {
  BinocularsIcon,
  CalendarXIcon,
  CircleNotchIcon,
  MagnifyingGlassIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useSearchRoutes } from "@repo/api";
import type { Route } from "@shared/types";
import dayjs from "dayjs";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo, useRef } from "react";
import { searchParams } from "~/lib/type";
import { toSearchTrip } from "~/lib/utils";
import TripCardItem from "./TripCardItem";
import TripFilter from "./TripFilter";
import TripState from "./TripState";

const TripSearchSection = () => {
  const [query] = useQueryStates(
    {
      from: searchParams.from,
      to: searchParams.to,
      date: searchParams.date,
      vehicleType: searchParams.vehicleType,
    },
    { history: "replace" },
  );

  const hasSearchParams = Boolean(query.from && query.to);
  const urlDate = query.date || dayjs().format("YYYY-MM-DD");

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useSearchRoutes({
    params: hasSearchParams
      ? {
          from: query.from ?? undefined,
          to: query.to ?? undefined,
          date: urlDate,
          vehicleType: query.vehicleType ?? undefined,
        }
      : {},
    enabled: hasSearchParams,
  });

  const routes: Route[] = useMemo(
    () => data?.pages?.flatMap((page) => page) ?? [],
    [data],
  );

  const lastTripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lastTripRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(lastTripRef.current);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!hasSearchParams) {
    return (
      <TripState
        routes={undefined}
        icon={<MagnifyingGlassIcon className="w-6 h-6 text-neutral-500" />}
        title="Where are you headed?"
        description="Pick your starting point, destination, and date to find the perfect trip."
      />
    );
  }

  if (isLoading) {
    return (
      <TripState
        routes={[]}
        icon={<BinocularsIcon className="w-6 h-6 text-neutral-500" />}
        title="Searching routes"
        description="Finding available rides for your route."
      />
    );
  }

  if (error) {
    return (
      <TripState
        routes={[]}
        icon={<WarningCircleIcon className="w-6 h-6 text-neutral-500" />}
        title="Routes temporarily unavailable"
        description="We’re unable to load available rides right now. Please try again shortly."
      />
    );
  }

  const searchTrips = routes.map((item) => toSearchTrip(item));

  if (searchTrips.length === 0) {
    return (
      <TripState
        routes={routes}
        icon={<CalendarXIcon className="w-6 h-6 text-neutral-500" />}
        title="No rides available"
        description="We couldn’t find any rides for your selected route and time. Try adjusting your trip details."
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      <TripFilter routes={routes} onApplyFilters={() => refetch()} />
      <div className="flex-1 w-full">
        <div className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl text-neutral-900 font-semibold">
              {searchTrips.length} results
            </h3>
            <p className="text-base text-muted-foreground">
              Fares displayed are for all passengers.
            </p>
          </div>

          {searchTrips.map((item, index) => (
            <div
              key={item.searchResultId}
              ref={index === searchTrips.length - 1 ? lastTripRef : undefined}
            >
              <TripCardItem item={item} bookingDate={urlDate} />
            </div>
          ))}

          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <CircleNotchIcon className="w-6 h-6 animate-spin text-neutral-500" />
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Fares may change depending on the selected trips and dates, and are
            not final until payment is completed and the booking is confirmed.
            Prices are per person and do not include luggage fees. Bookings are
            non-refundable once trips are confirmed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TripSearchSection;
