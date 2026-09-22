"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "~/components/ui/button";
import {
  PassengerDrawer,
  MAX_PASSENGERS,
  type TripPassenger,
} from "./passenger-drawer";
import { PassengerListItem } from "./passenger-list-item";
import {
  MOCK_ORIGINS,
  getDestinationsForOrigin,
  getUpcomingDateSlots,
  formatTripTime,
} from "~/lib/trip";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base font-semibold text-neutral-900">
      {children}
    </p>
  );
}

export default function NewTripBooking() {
  const [selectedOrigin, setSelectedOrigin] = useState<string>("");
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>("");
  const [selectedDateKey, setSelectedDateKey] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [passengers, setPassengers] = useState<TripPassenger[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const atLimit = passengers.length >= MAX_PASSENGERS;

  const handleAddPassenger = () => {
    setEditingId(null);
    setDrawerOpen(true);
  };

  const handleEditPassenger = (id: string) => {
    setEditingId(id);
    setDrawerOpen(true);
  };

  const handleRemovePassenger = (id: string) => {
    setPassengers((current) =>
      current.filter((passenger) => passenger.id !== id),
    );
    if (editingId === id) setEditingId(null);
  };

  const dateSlots = useMemo(() => getUpcomingDateSlots(3), []);
  const effectiveDateKey =
    selectedDateKey || dateSlots[0]?.dateKey || "";

  const selectedOriginData = MOCK_ORIGINS.find(
    (origin) => origin.id === selectedOrigin,
  );

  const destinations = useMemo(
    () => (selectedOriginData ? getDestinationsForOrigin(selectedOriginData) : []),
    [selectedOriginData],
  );

  const handleOriginChange = (origin: string) => {
    setSelectedOrigin(origin);
    setSelectedDestinationId("");
    setSelectedTime("");
  };

  const departureSlots = useMemo(() => {
    if (!selectedOriginData) return [];
    const nowTime = format(new Date(), "HH:mm");
    const isToday = effectiveDateKey === format(new Date(), "yyyy-MM-dd");
    return selectedOriginData.departureTime.map((time) => ({
      time,
      disabled: isToday && time <= nowTime,
    }));
  }, [selectedOriginData, effectiveDateKey]);

  const handleDestinationChange = (destinationId: string) => {
    setSelectedDestinationId(destinationId);
    setSelectedTime("");
  };

  const luggageCount = passengers.filter((p) => p.carriesLuggage).length;
  const fareTotal =
    passengers.length *
    ((selectedOriginData?.fare ?? 0) + (selectedOriginData?.fee ?? 0));
  const luggageTotal = luggageCount * (selectedOriginData?.luggageFee ?? 0);
  const total = fareTotal + luggageTotal;

  const canConfirm =
    selectedOrigin !== "" &&
    selectedDestinationId !== "" &&
    selectedTime !== "" &&
    passengers.length >= 1 &&
    !drawerOpen;

  const handleConfirm = () => {
    if (!canConfirm) return;
  };

  return (
    <div className="flex w-full flex-col gap-10">
      <div>
        <SectionLabel>Select date</SectionLabel>
        <div className="mt-4 flex flex-wrap gap-3">
          {dateSlots.map((slot) => {
            const isSelected = effectiveDateKey === slot.dateKey;
            return (
              <button
                key={slot.dateKey}
                type="button"
                disabled={slot.isPast}
                onClick={() => {
                  setSelectedDateKey(slot.dateKey);
                }}
                className={cn(
                  "flex w-16 cursor-pointer flex-col items-center gap-2 rounded-2xl border px-2 py-3 transition-colors",
                  slot.isPast
                    ? "cursor-not-allowed border-neutral-200 text-neutral-300"
                    : isSelected
                      ? "border-blue-300 bg-blue-100"
                      : "border-neutral-300 hover:bg-neutral-50",
                )}
              >
                <span
                  className={cn(
                    "text-xs",
                    isSelected ? "text-blue-800" : "text-neutral-600",
                  )}
                >
                  {slot.day}
                </span>
                <span
                  className={cn(
                    "text-lg font-semibold",
                    isSelected ? "text-blue-900" : "text-neutral-900",
                  )}
                >
                  {slot.date}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-md">
        <SectionLabel>Origin</SectionLabel>
        <div className="relative mt-4">
          <select
            value={selectedOrigin}
            onChange={(event) => handleOriginChange(event.target.value)}
            className="h-12 w-full cursor-pointer appearance-none rounded-full border border-neutral-300 bg-background px-6 pr-12 text-sm text-foreground transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
          >
            <option value="" disabled>
              Choose an origin
            </option>
            {MOCK_ORIGINS.map((origin) => (
              <option key={origin.id} value={origin.id}>
                {origin.title}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        </div>
      </div>

      <div className="max-w-md">
        <SectionLabel>Destination</SectionLabel>
        <div className="relative mt-4">
          <select
            value={selectedDestinationId}
            onChange={(event) => handleDestinationChange(event.target.value)}
            className="h-12 w-full cursor-pointer appearance-none rounded-full border border-neutral-300 bg-background px-6 pr-12 text-sm text-foreground transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
          >
            <option value="" disabled>
              Choose a destination
            </option>
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.id}>
                {destination.title}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        </div>
      </div>

      <div>
        <SectionLabel>Departure time</SectionLabel>
        {selectedOriginData ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {departureSlots.map(({ time, disabled }) => {
              const isSelected = selectedTime === time;
              return (
                <button
                  key={time}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setSelectedTime(time);
                  }}
                  className={cn(
                    "cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    disabled
                      ? "cursor-not-allowed border-neutral-200 text-neutral-300"
                      : isSelected
                        ? "border-blue-300 bg-blue-100 text-blue-800"
                        : "border-neutral-300 text-neutral-900 hover:bg-neutral-50",
                  )}
                >
                  {formatTripTime(time)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Select an origin first.
          </p>
        )}
      </div>

      <div className="max-w-md">
        <SectionLabel>Meeting point</SectionLabel>
        <p className="mt-2 text-sm">
          {selectedOriginData?.meetingPoint ?? "Select an origin first."}
        </p>
      </div>

      <div className="max-w-md">
        <SectionLabel>Passengers</SectionLabel>
        <p className="mt-2 text-sm text-muted-foreground">
          Maximum of {MAX_PASSENGERS} passengers per booking.
        </p>

        {passengers.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {passengers.map((passenger) => (
              <PassengerListItem
                key={passenger.id}
                passenger={passenger}
                onEdit={handleEditPassenger}
                onRemove={handleRemovePassenger}
              />
            ))}
          </ul>
        )}

        <button
          type="button"
          disabled={atLimit}
          onClick={handleAddPassenger}
          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-neutral-300 px-6 py-3 font-semibold text-sm text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {atLimit ? "Maximum reached" : "Add passenger"}
        </button>
      </div>

      <div>
        <h2 className="text-xl font-bold text-neutral-900">Pricing</h2>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-base font-bold text-neutral-900">Total:</span>
          <span className="text-xl font-bold text-neutral-900">
            ₦{total.toLocaleString("en-NG")}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">incl. luggage fee</span>
          <span className="text-sm font-medium text-muted-foreground">
            ₦{luggageTotal.toLocaleString("en-NG")}
          </span>
        </div>
        <Button
          pill
          size="lg"
          disabled={!canConfirm}
          onClick={handleConfirm}
          className="mt-5 w-full text font-semibold"
        >
          Confirm Booking
        </Button>
      </div>

      <PassengerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        passengers={passengers}
        onPassengersChange={setPassengers}
        editingId={editingId}
        onEditingChange={setEditingId}
      />
    </div>
  );
}
