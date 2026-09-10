"use client";

import { PlaneDots } from "@repo/ui/PlaneDots";
import { CircleIcon } from "@phosphor-icons/react";
import type { TRoute } from "@repo/types/routeSchema";
import type { Route } from "@shared/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { useState } from "react";
import { parseLocalDate } from "~/lib/utils";
import RouteBookingSheet from "./RouteBookingSheet";
import RouteSheetDetails from "./RouteSheetDetails";

dayjs.extend(duration);

interface RouteCardProps {
  route: Route;
  bookingDate: string;
}

export default function RouteCard({ route, bookingDate }: RouteCardProps) {
  const [bookOpen, setBookOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const timeBaseDate = parseLocalDate(bookingDate);

  const makeTimeDate = (time: string) => {
    const [hours = 0, minutes = 0] = time.split(":").map(Number);
    const date = new Date(timeBaseDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const departureDate = makeTimeDate(route.departure_time);
  const arrivalDate = makeTimeDate(route.arrival_time);

  const departureTime = dayjs(departureDate).format("h:mma");
  const arrivalTime = dayjs(arrivalDate).format("h:mma");

  const tripDuration = dayjs.duration(arrivalDate.getTime() - departureDate.getTime());
  const totalHours = Math.floor(tripDuration.asHours());
  const minutes = tripDuration.minutes();
  const durationText =
    totalHours > 0 && minutes > 0
      ? `${totalHours}h ${minutes}m`
      : totalHours > 0
        ? `${totalHours}h`
        : `${minutes}m`;

  // const stopCount = route.intermediate_stops_title ? 1 : 0;
  // const stopsLabel =
  //   stopCount === 0
  //     ? "Nonstop"
  //     : stopCount === 1
  //       ? "1 Stop"
  //       : `${stopCount} Stops`;

  const tripForDetails: TRoute = {
    departureCity: {
      title: route.pickup_location_title,
      locality: route.pickup_location_locality,
      label: route.pickup_location_label,
    },
    arrivalCity: {
      title: route.dropoff_location_title,
      locality: route.dropoff_location_locality,
      label: route.dropoff_location_label,
    },
    vehicleType: "car",
    departureTime: departureDate,
    estimatedArrivalTime: arrivalDate,
    meetingPoint: route.meeting_point,
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setBookOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setBookOpen(true);
          }
        }}
        className="w-full bg-white rounded-2xl overflow-hidden px-1 cursor-pointer"
      >
        <div className="flex items-center px-2 py-5 gap-6">
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-[auto_1fr_auto] gap-y-1 items-center">
              <span className="text-lg lg:text-xl font-medium text-neutral-900 whitespace-nowrap">
                {departureTime}
              </span>

              <div className="flex justify-center px-2">
                <PlaneDots />
              </div>

              <span className="text-lg lg:text-xl font-medium text-neutral-900 whitespace-nowrap">
                {arrivalTime}
              </span>

              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {route.pickup_location_title}
              </span>

              <span className="text-sm text-muted-foreground text-center whitespace-nowrap">
                {durationText}
                {/* <CircleIcon size={5} weight="fill" className="mx-0.5 inline-block align-middle" /> {stopsLabel} */}
              </span>

              <span className="text-sm text-end text-muted-foreground">
                {route.dropoff_location_title}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetailsOpen(true);
              }}
              className="mt-4 text-sm font-medium text-neutral-800 underline underline-offset-2 hover:text-black cursor-pointer"
            >
              Trip details
            </button>
          </div>
        </div>
      </div>

      <RouteBookingSheet
        route={route}
        open={bookOpen}
        onOpenChange={setBookOpen}
        bookingDate={bookingDate}
      />

      <RouteSheetDetails
        trip={tripForDetails}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        bookingContext={{ tripDate: bookingDate }}
        showDriverDetails={false}
        intermediateStop={
          route.intermediate_stops_title
            ? {
                title: route.intermediate_stops_title,
                locality: route.intermediate_stops_locality ?? "",
                label: route.intermediate_stops_label ?? "",
              }
            : null
        }
      />
    </>
  );
}