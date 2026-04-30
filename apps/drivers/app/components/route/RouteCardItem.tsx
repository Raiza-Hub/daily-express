"use client";

import { ProhibitIcon } from "@phosphor-icons/react";
import { useUpdateTripStatus } from "@repo/api";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/components/sonner";
import { PlaneDots } from "@repo/ui/PlaneDots";
import { useState } from "react";
import PassengersSheet from "./PassengersSheet";
import PassengerStatusBar from "./PassengerStatusBar";
import RouteCardActionMenu from "./RouteCardActionMenu";
import { RouteWithTrips } from "~/lib/type";


const RouteCardItem = ({
    route,
}: {
    route: RouteWithTrips;
}) => {
    const [passengersOpen, setPassengersOpen] = useState(false);

    const handlePassengers = () => {
        setPassengersOpen(true);
    };

    const updateTripStatus = useUpdateTripStatus({
        onSuccess: () => {
            toast.success("Booking stopped successfully");
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    const handleStopBooking = () => {
        updateTripStatus.mutate({ id: route.tripId, status: "booking_closed" });
    };

    return (
        <div className="group relative flex flex-col rounded-xl bg-white border border-slate-200 transition-all duration-200">
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
                            className="hidden md:inline-flex rounded-lg border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 gap-2 font-medium"
                            onClick={handleStopBooking}
                        >
                            <ProhibitIcon size={18} />
                            Stop Booking
                        </Button>

                        <div className="md:hidden shrink-0">
                            <RouteCardActionMenu
                                onPassengers={handlePassengers}
                                onStopBooking={handleStopBooking}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="hidden md:block border-t border-slate-100" />

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
}

export default RouteCardItem;