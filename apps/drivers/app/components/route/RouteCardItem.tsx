"use client";

import { CheckCircleIcon } from "@phosphor-icons/react";
import { useCompleteTrip } from "@repo/api";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/components/sonner";
import { PlaneDots } from "@repo/ui/PlaneDots";
import { useEffect, useState } from "react";
import PassengersSheet from "./PassengersSheet";
import PassengerStatusBar from "./PassengerStatusBar";
import RouteCardActionMenu from "./RouteCardActionMenu";
import { RouteWithTrips } from "~/lib/type";

const RouteCardItem = ({ route }: { route: RouteWithTrips }) => {
  const [passengersOpen, setPassengersOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isCompleted = route.status === "completed";
  const arrivalAtMs = new Date(route.arrivalAt).getTime();
  const hasTripArrived = Number.isFinite(arrivalAtMs) && nowMs >= arrivalAtMs;

  const handlePassengers = () => {
    setPassengersOpen(true);
  };

  useEffect(() => {
    if (!Number.isFinite(arrivalAtMs) || hasTripArrived) {
      return;
    }

    const maxTimeoutMs = 2_147_483_647;
    const timeout = window.setTimeout(
      () => setNowMs(Date.now()),
      Math.min(Math.max(arrivalAtMs - Date.now(), 0), maxTimeoutMs),
    );

    return () => window.clearTimeout(timeout);
  }, [arrivalAtMs, hasTripArrived]);

  const completeTrip = useCompleteTrip({
    onSuccess: () => {
      toast.success("Trip marked as completed!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCompleteTrip = () => {
    if (!hasTripArrived) {
      toast.error("Trip has not arrived yet.");
      return;
    }
    if (isCompleted || completeTrip.isPending) {
      return;
    }

    completeTrip.mutate({ id: route.tripId });
  };

  const isDisabled = isCompleted || completeTrip.isPending;
  const buttonLabel = isCompleted
    ? "Trip Completed"
    : completeTrip.isPending
      ? "Completing..."
      : "Mark Completed";

  return (
    <div className="group relative flex flex-col rounded-xl bg-white border border-neutral-200 transition-all duration-200">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 p-6">
        <div className="flex flex-col gap-0.5 md:w-min">
          <div className="flex items-center gap-2">
            <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight whitespace-nowrap">
              {route.departureTime}
            </span>
            <PlaneDots />
            <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight relative whitespace-nowrap">
              {route.arrivalTime}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {route.departureCity.title} ({route.departureCity.locality}) –{" "}
            {route.arrivalCity.title} ({route.arrivalCity.locality})
          </p>
        </div>

        <div className="flex flex-row items-center justify-between gap-4 md:gap-6 flex-1 lg:flex-none w-full lg:w-auto">
          <div className="flex-1 md:flex-none md:w-[260px]">
            <PassengerStatusBar
              bookedSeats={route.bookedSeats}
              capacity={route.capacity}
            />
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              className="hidden md:inline-flex rounded-lg border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 gap-2 font-medium disabled:border-emerald-100 disabled:text-emerald-400 disabled:opacity-60"
              disabled={isDisabled}
              onClick={handleCompleteTrip}
            >
              <CheckCircleIcon size={18} />
              {buttonLabel}
            </Button>

            <div className="md:hidden shrink-0">
              <RouteCardActionMenu
                onPassengers={handlePassengers}
                onTripAction={handleCompleteTrip}
                tripActionDisabled={isDisabled}
                tripActionLabel={buttonLabel}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:block border-t border-neutral-100" />

      <div className="hidden md:flex justify-end px-6 py-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={handlePassengers}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
        >
          Passengers
        </button>
      </div>

      <PassengersSheet
        tripId={route.tripId}
        open={passengersOpen}
        onOpenChange={setPassengersOpen}
      />
    </div>
  );
};

export default RouteCardItem;
