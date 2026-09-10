"use client";

import {
  BinocularsIcon,
  CalendarXIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PaperPlaneTiltIcon,
  WarningCircleIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useSearchRoutes } from "@repo/api";
import type { Route } from "@shared/types";
import dayjs from "dayjs";
import { useQueryStates } from "nuqs";
import { useState } from "react";
import { searchParams } from "~/lib/type";
import { FUNAAB_ORIGIN, FUNAAB_ROUTES } from "~/lib/routes.constants";
import SearchBar from "./SearchBar";
import TripState from "./TripState";
import TripBookingCards from "./TripBookingCards";

const ACCENT = "#1d4ed8";

function Tab({
  icon: Icon,
  label,
  active,
  onClick,
  iconClassName = "",
}: {
  icon: Icon;
  label: string;
  active: boolean;
  onClick: () => void;
  iconClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex items-center gap-2 pb-3 pt-1 text-sm font-medium"
    >
      <Icon
        className={`w-4 h-4 ${iconClassName} ${
          active ? "text-gray-900" : "text-gray-400"
        }`}
      />
      <span className={active ? "text-gray-900" : "text-gray-400"}>
        {label}
      </span>
      {active && (
        <span
          className="absolute left-1/2 -translate-x-1/2 w-8 -bottom-px h-0.5 rounded-full"
          style={{ backgroundColor: ACCENT }}
        />
      )}
    </button>
  );
}

const TripSearchSection = ({
  initialOrigin,
  initialDate,
}: {
  initialOrigin?: string | null;
  initialDate?: string | null;
}) => {
  const [query] = useQueryStates(
    {
      origin: searchParams.origin,
      date: searchParams.date,
    },
    { history: "replace" },
  );

  const [timeTab, setTimeTab] = useState<"departure" | "arrival">("departure");
  const isArrival = timeTab === "arrival";

  const originValue = query.origin ?? initialOrigin ?? "";
  const dateValue = query.date ?? initialDate;

  const hasSearchParams = Boolean(originValue);
  const isFunaabMock = originValue.trim().toUpperCase() === FUNAAB_ORIGIN;
  const urlDate = dateValue || dayjs().format("YYYY-MM-DD");
  const routeSearchParams = {
    origin: originValue,
    to: "",
    date: urlDate,
  };

  const { data, isLoading, error } = useSearchRoutes({
    params: routeSearchParams,
    enabled: hasSearchParams && !isFunaabMock,
  });

  const routes: Route[] = data?.pages?.flatMap((page) => page.routes) ?? [];

  if (isFunaabMock) {
    return (
      <div className="flex flex-col gap-6">
        <SearchBar
          key={`${initialOrigin}-${initialDate}`}
          initialOrigin={initialOrigin}
          initialDate={initialDate}
        />
        <div className="flex-1 w-full">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-5 border-b border-neutral-200">
              <Tab
                icon={PaperPlaneTiltIcon}
                label="Departure"
                active={!isArrival}
                onClick={() => setTimeTab("departure")}
              />
              <Tab
                icon={MapPinIcon}
                label="Arrival"
                active={isArrival}
                onClick={() => setTimeTab("arrival")}
              />
            </div>

            {FUNAAB_ROUTES.map((route) => (
              <div key={route.id} className="flex flex-col gap-4">
                <TripBookingCards
                  route={route}
                  tripDate={urlDate}
                  timeTab={timeTab}
                />
              </div>
            ))}

            <p className="text-sm text-muted-foreground">
              Fares may change depending on the selected trips and dates, and
              are not final until payment is completed and the booking is
              confirmed. Bookings are non-refundable once trips are confirmed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasSearchParams) {
    return (
      <TripState
        icon={<MagnifyingGlassIcon className="size-6 text-neutral-500" />}
        title="Where are you headed?"
        description="Pick your starting point and date to find the perfect trip."
        initialOrigin={initialOrigin}
        initialDate={initialDate}
      />
    );
  }

  if (isLoading) {
    return (
      <TripState
        icon={<BinocularsIcon className="size-6 text-neutral-500" />}
        title="Searching routes"
        description="Finding available rides for your route."
        initialOrigin={initialOrigin}
        initialDate={initialDate}
        disabled={isLoading}
      />
    );
  }

  if (error) {
    return (
      <TripState
        icon={<WarningCircleIcon className="size-6 text-neutral-500" />}
        title="Routes temporarily unavailable"
        description="We’re unable to load available rides right now. Please try again shortly."
        initialOrigin={initialOrigin}
        initialDate={initialDate}
      />
    );
  }

  if (routes.length === 0) {
    return (
      <TripState
        icon={<CalendarXIcon className="size-6 text-neutral-500" />}
        title="No rides available"
        description="We couldn’t find any rides for your selected route and time. Try adjusting your trip details."
        initialOrigin={initialOrigin}
        initialDate={initialDate}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <SearchBar
        key={`${initialOrigin}-${initialDate}`}
        initialOrigin={initialOrigin}
        initialDate={initialDate}
      />
      <div className="flex-1 w-full">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-5 border-b border-neutral-200">
            <Tab
              icon={PaperPlaneTiltIcon}
              label="Departure"
              active={!isArrival}
              onClick={() => setTimeTab("departure")}
            />
            <Tab
              icon={MapPinIcon}
              label="Arrival"
              active={isArrival}
              onClick={() => setTimeTab("arrival")}
            />
          </div>

          {routes.map((route) => (
            <div key={route.id} className="flex flex-col gap-4">
              <TripBookingCards
                route={route}
                tripDate={urlDate}
                timeTab={timeTab}
              />
            </div>
          ))}

          <p className="text-sm text-muted-foreground">
            Fares may change depending on the selected trips and dates, and are
            not final until payment is completed and the booking is confirmed.
            Bookings are non-refundable once trips are confirmed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TripSearchSection;