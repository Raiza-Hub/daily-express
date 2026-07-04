"use client";

import { useClaimTrip, useGetVehicles, type AvailableTrip } from "@repo/api";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/components/sonner";
import { PlaneDots } from "@repo/ui/PlaneDots";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import dayjs from "dayjs";
import Link from "next/link";
import { useState } from "react";
import { combineTripDateAndTime } from "~/lib/utils";
import PassengerStatusBar from "./PassengerStatusBar";

interface ClaimTripCardItemProps {
  trip: AvailableTrip;
  onClaimSuccess?: () => void;
}

export default function ClaimTripCardItem({
  trip,
  onClaimSuccess,
}: ClaimTripCardItemProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  const { data: vehicles, isLoading: vehiclesLoading } = useGetVehicles();
  const claimTrip = useClaimTrip({
    onSuccess: () => {
      toast.success("Trip claimed successfully!");
      onClaimSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to claim trip.");
    },
  });

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

  const departureTime = dayjs(departureDateTime).format("h:mma");
  const arrivalTime = dayjs(arrivalDateTime).format("h:mma");

  const hasNoVehicles = !vehiclesLoading && (!vehicles || vehicles.length === 0);

  const handleClaim = () => {
    if (!selectedVehicleId) {
      toast.error("Please select a vehicle to claim this trip.");
      return;
    }
    claimTrip.mutate({ id: trip.tripId, vehicleId: selectedVehicleId });
  };

  const isClaimDisabled =
    !selectedVehicleId || claimTrip.isPending || vehiclesLoading || hasNoVehicles;

  return (
    <div className="group relative rounded-xl bg-white border border-neutral-200 transition-all duration-200">
      <div className="grid grid-cols-1 gap-4 p-6">
        {/* Section 1: Route and Times */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-lg font-medium text-neutral-900 tracking-tight whitespace-nowrap">
              {departureTime}
            </span>
            <PlaneDots className="sm:min-w-0" />
            <span className="text-lg font-medium text-neutral-900 tracking-tight relative whitespace-nowrap">
              {arrivalTime}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {trip.route.pickup_location_label} ({trip.route.pickup_location_locality}) –{" "}
            {trip.route.dropoff_location_label} ({trip.route.dropoff_location_locality})
          </p>
        </div>

        {/* Section 2: Passenger Status/Seat Capacity */}
        <div>
          <PassengerStatusBar
            bookedSeats={trip.bookedSeats}
            capacity={trip.capacity}
          />
        </div>

        {/* Section 3: Vehicle Select */}
        <div>
          {vehicles && vehicles.length > 0 ? (
            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
              <SelectTrigger size="default" className="w-full">
                <SelectValue placeholder="Select Vehicle" />
              </SelectTrigger>
              <SelectContent position="popper">
                {vehicles.map((v) => {
                  const isInUse = v.status === "in_use";
                  return (
                    <SelectItem
                      key={v.id}
                      value={v.id}
                      disabled={isInUse}
                    >
                      <span className={isInUse ? "text-neutral-400 line-through" : ""}>
                        {v.color} {v.make} {v.model}
                      </span>
                      {isInUse && (
                        <span className="text-xs text-neutral-400 ml-2 font-normal">
                          (In Use)
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-500">
              <span>No vehicles registered.</span>
              <Link
                href="/vehicles"
                className="font-medium text-blue-600 hover:text-blue-700 underline"
              >
                Add one
              </Link>
            </div>
          )}
        </div>

        {/* Section 4: Accept/Claim Button */}
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-medium disabled:opacity-60 w-full"
          disabled={isClaimDisabled}
          onClick={handleClaim}
        >
          {claimTrip.isPending ? "Accepting..." : "Accept"}
        </Button>
      </div>
    </div>
  );
}