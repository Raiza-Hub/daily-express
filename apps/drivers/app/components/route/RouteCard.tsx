"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { TrashIcon } from "@phosphor-icons/react";
import EditRouteSheet from "./EditRouteSheet";
import PassengersSheet from "./PassengersSheet";
import PassengerStatusBar from "./PassengerStatusBar";
import { Button } from "@repo/ui/components/button";
import RouteCardActionMenu from "./RouteCardActionMenu";
import { PlaneDots } from "@repo/ui/PlaneDots";
import { useGetTripsSummary, TripsSummary } from "@repo/api";

interface RouteWithTrips {
  id: string;
  departureTime: string;
  departureCode: string;
  arrivalTime: string;
  arrivalCode: string;
  bookedSeats: number;
  capacity: number;
  earnings: number;
}

function RouteCardItem({
  route,
  onEdit,
  onPassengers,
}: {
  route: RouteWithTrips;
  onEdit: () => void;
  onPassengers: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [passengersOpen, setPassengersOpen] = useState(false);

  const handleEdit = () => {
    setEditOpen(true);
    onEdit();
  };

  const handlePassengers = () => {
    setPassengersOpen(true);
    onPassengers();
  };

  return (
    <div className="group relative flex flex-col lg:flex-row items-stretch gap-6 rounded-xl bg-white p-6 border border-slate-200 transition-all duration-200">
      {/* Left Section — Route Info */}
      <div className="flex-1 flex flex-col justify-center">
        {/* Flight Times & Route */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight">
              {route.departureTime}
            </span>
            <PlaneDots />
            <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight">
              {route.arrivalTime}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {route.departureCode} – {route.arrivalCode}
          </p>
        </div>
      </div>

      {/* Right Section — Prices */}
      <div className="w-full lg:w-auto flex-1 flex items-center justify-between lg:justify-end gap-6">
        {/* Passenger Status + sm action menu */}
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex-1 sm:min-w-[220px] sm:max-w-[260px]">
            <PassengerStatusBar
              bookedSeats={route.bookedSeats}
              capacity={route.capacity}
            />
          </div>
          {/* Action menu — sm only */}
          <div className="sm:hidden shrink-0">
            <RouteCardActionMenu
              onEdit={handleEdit}
              onPassengers={handlePassengers}
              onDelete={() => console.log("delete")}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="hidden lg:block h-12 w-px bg-slate-200" />

        {/* Action Buttons (desktop) + shared controlled sheets (mobile) */}
        <div className="hidden sm:flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
          <EditRouteSheet
            defaultValues={{
              departureCity: { title: "", locality: "", label: "" },
              arrivalCity: { title: "", locality: "", label: "" },
              vehicleType: "car",
              seatNumber: 8,
              price: 900000,
              departureTime: new Date("2026-02-10T15:30:00"),
              estimatedArrivalTime: new Date("2026-02-11T09:43:00"),
            }}
          />

          {/* Passengers */}
          <PassengersSheet />

          {/* Delete - Destructive */}
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-lg border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300"
            onClick={() => console.log("delete")}
          >
            <TrashIcon size={18} />
          </Button>
        </div>

        {/* Controlled sheets for mobile menu (rendered outside sm:hidden so they're always in the tree) */}
        <EditRouteSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          defaultValues={{
            departureCity: { title: "", locality: "", label: "" },
            arrivalCity: { title: "", locality: "", label: "" },
            vehicleType: "car",
            seatNumber: 8,
            price: 900000,
            departureTime: new Date("2026-02-10T15:30:00"),
            estimatedArrivalTime: new Date("2026-02-11T09:43:00"),
          }}
        />
        <PassengersSheet
          open={passengersOpen}
          onOpenChange={setPassengersOpen}
        />
      </div>
    </div>
  );
}

export default function RouteCard() {
  const today = dayjs().format("YYYY-MM-DD");
  const { data: tripsSummary, isLoading } = useGetTripsSummary(today);

  const routes: RouteWithTrips[] =
    tripsSummary?.trips.map((trip) => ({
      id: trip.id,
      departureTime: dayjs(trip.date).format("h:mma"),
      departureCode: trip.route.pickup_location_title,
      arrivalTime: dayjs(trip.date).add(2, "hour").format("h:mma"),
      arrivalCode: trip.route.dropoff_location_title,
      bookedSeats: trip.bookedSeats,
      capacity:
        trip.route.price > 0 ? Math.ceil(trip.earnings / trip.route.price) : 0,
      earnings: trip.earnings,
    })) || [];

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
      <div className="flex flex-col gap-4 text-center py-12">
        <p className="text-muted-foreground">No trips scheduled for today</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {routes.map((route, index) => (
        <RouteCardItem
          key={route.id || index}
          route={route}
          onEdit={() => console.log("edit")}
          onPassengers={() => console.log("passengers")}
        />
      ))}
    </div>
  );
}
