"use client";

import { CarProfileIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dayjs from "dayjs";

import type { TRoute } from "@repo/types/routeSchema";
import TripDetailsSheet from "./TripDetailsSheet";
import { PlaneDots } from "@repo/ui/PlaneDots";
import { DriverInfo } from "~/components/trip/DriverInfo";
import type { DriverInfoProps } from "~/components/trip/DriverInfo";
import { formatPrice } from "@repo/ui/lib/utils";
import { useSearchRoutes } from "@repo/api";
import type { Route } from "@shared/types";
import { useQueryStates } from "nuqs";
import { searchParams } from "../../search-params";
import { useRef, useEffect } from "react";
import { CircleNotch } from "@phosphor-icons/react";

interface SearchTrip {
  id: string;
  routeId: string;
  route: TRoute;
  availableSeats: number;
  driver?: {
    firstName: string;
    lastName: string;
    phone: string;
    profile_pic?: string | null;
    country: string;
    state: string;
  };
}

function toSearchTrip(item: Route): SearchTrip {
  return {
    id: item.id,
    routeId: item.id,
    availableSeats: item.availableSeats,
    driver: item.driver
      ? {
          firstName: item.driver.firstName,
          lastName: item.driver.lastName,
          phone: item.driver.phone,
          profile_pic: item.driver.profile_pic ?? undefined,
          country: item.driver.country,
          state: item.driver.state,
        }
      : undefined,
    route: {
      departureCity: {
        title: item.pickup_location_title,
        locality: item.pickup_location_locality,
        label: item.pickup_location_label,
      },
      arrivalCity: {
        title: item.dropoff_location_title,
        locality: item.dropoff_location_locality,
        label: item.dropoff_location_label,
      },
      vehicleType: item.vehicleType,
      seatNumber: item.availableSeats,
      price: item.price,
      departureTime: new Date(item.departure_time),
      estimatedArrivalTime: new Date(item.arrival_time),
      meetingPoint: item.meeting_point,
    },
  };
}

function TripCardItem({
  item,
  bookingDate,
}: {
  item: SearchTrip;
  bookingDate: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const departureTime = dayjs(item.route.departureTime).format("h:mma");
  const arrivalTime = dayjs(item.route.estimatedArrivalTime).format("h:mma");

  return (
    <>
      <div
        className="w-full bg-white rounded-2xl overflow-hidden border border-gray-200 cursor-pointer"
        onClick={() => setSheetOpen(true)}
      >
        {/* Main Card Row */}
        <div className="flex flex-col md:flex-row md:items-center px-6 py-5 gap-4 md:gap-5">
          {/* Flight Times & Route */}
          <div className="flex flex-col gap-0.5 md:w-min">
            <div className="flex items-center gap-2">
              <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight whitespace-nowrap">
                {departureTime}
              </span>
              <PlaneDots />
              <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight relative whitespace-nowrap">
                {arrivalTime}
                {/* <sup className="text-xs text-rose-500 font-semibold ml-0.5">+1</sup> */}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {item.route.departureCity.title} (
              {item.route.departureCity.locality}) –{" "}
              {item.route.arrivalCity.title} ({item.route.arrivalCity.locality})
            </p>
          </div>

          {/* Spacer (md+) */}
          <div className="hidden md:flex flex-1" />

          {/* Transport mode & Price row (sm: below route, md+: inline) */}
          <div className="flex items-center md:contents gap-5">
            {/* Transport mode — sm only: text only */}
            <div className="flex md:hidden flex-col items-center gap-1">
              <p className="text-sm font-medium text-neutral-900">
                Transport:{" "}
                <span className="capitalize">{item.route.vehicleType}</span>
              </p>
            </div>

            {/* Transport mode — md+ only: icon + label */}
            <div className="hidden md:flex flex-col items-center gap-1">
              <CarProfileIcon weight="duotone" size={24} />
              <p className="text-sm text-muted-foreground">Transport</p>
            </div>

            {/* Spacer (md+) */}
            <div className="hidden md:flex flex-1" />

            {/* Price — sm only: no label, smaller */}
            <div className="flex md:hidden flex-col items-end ml-auto">
              <p className="text-xl font-medium text-neutral-900">
                {formatPrice(item.route.price)}
              </p>
            </div>

            {/* Price — md+ only: with label */}
            <div className="hidden md:flex flex-col items-end">
              <p className="text-2xl font-medium text-neutral-900">
                {formatPrice(item.route.price)}
              </p>
              <p className="text-sm text-muted-foreground">Price</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Footer */}
        <div className="flex justify-end px-6 py-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
          >
            {expanded ? "Hide details" : "Driver details"}
          </button>
        </div>

        {/* Expanded Details */}
        <AnimatePresence initial={false}>
          {expanded && item.driver && (
            <motion.div
              key="driver-details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: "hidden" }}
            >
              <DriverInfo
                firstName={item.driver.firstName}
                lastName={item.driver.lastName}
                phoneNumber={item.driver.phone}
                country={item.driver.country}
                state={item.driver.state}
                profilePictureUrl={item.driver.profile_pic ?? ""}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <TripDetailsSheet
        trip={item.route}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        bookingContext={{
          routeId: item.routeId,
          tripDate: bookingDate,
          availableSeats: item.availableSeats,
        }}
      />
    </>
  );
}

export default function TripCard() {
  const [query] = useQueryStates(
    {
      from: searchParams.from,
      to: searchParams.to,
    },
    { history: "replace" },
  );

  const hasSearchParams = Boolean(query.from && query.to);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSearchRoutes({
    params: hasSearchParams
      ? {
          from: query.from ?? undefined,
          to: query.to ?? undefined,
        }
      : {},
    enabled: hasSearchParams,
  });

  const routes = data?.pages?.flatMap((page) => page) ?? [];

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

  const searchTrips = routes.map((item) => toSearchTrip(item));

  if (!hasSearchParams) {
    return (
      <div className="flex flex-col gap-4 pt-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl text-neutral-900 font-semibold">
            Find your next trip
          </h3>
          <p className="text-base text-muted-foreground">
            Enter your departure location, destination, and date to search for
            available trips.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 pt-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl text-neutral-900 font-semibold">
            Searching routes
          </h3>
          <p className="text-base text-muted-foreground">
            Finding available trips for your route.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 pt-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl text-neutral-900 font-semibold">
            Routes unavailable
          </h3>
          <p className="text-base text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  if (searchTrips.length === 0) {
    return (
      <div className="flex flex-col gap-4 pt-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl text-neutral-900 font-semibold">
            No trips found
          </h3>
          <p className="text-base text-muted-foreground">
            No trips available for your search. Try changing your search
            criteria.
          </p>
        </div>
      </div>
    );
  }

  return (
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
          key={item.id}
          ref={index === searchTrips.length - 1 ? lastTripRef : undefined}
        >
          <TripCardItem
            item={item}
            bookingDate={dayjs().format("YYYY-MM-DD")}
          />
        </div>
      ))}

      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <CircleNotch className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Fares may change depending on the selected trips and dates, and are not
        final until payment is completed and the booking is confirmed. Prices
        are per person and do not include luggage fees. Bookings are
        non-refundable once trips are confirmed.
      </p>
    </div>
  );
}
