"use client";

import { CircleNotchIcon, UsersIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useGetTripBookings } from "@repo/api";
import { Button } from "@repo/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/sheet";
import { useState } from "react";

interface PassengersSheetProps {
  tripId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function PassengersSheet({
  tripId,
  open,
  onOpenChange,
}: PassengersSheetProps) {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? !!open : internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
      return;
    }

    onOpenChange?.(nextOpen);
  };

  const {
    data: bookings,
    isLoading,
    isError,
    refetch,
  } = useGetTripBookings(tripId, {
    enabled: !!tripId && isOpen,
  });

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      {!isControlled && tripId && (
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-lg border-slate-200 hover:bg-slate-100"
          >
            <UsersThreeIcon size={18} />
          </Button>
        </SheetTrigger>
      )}

      <SheetContent className="w-full sm:max-w-[420px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b px-6">
          <SheetTitle className="text-xl font-semibold">Passengers</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground mt-1">
            {bookings?.length
              ? `${bookings.length} passenger${bookings.length > 1 ? "s" : ""} booked on this trip.`
              : "List of passengers booked on this trip."}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-3 px-6">
          {!tripId ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No trip selected.
            </p>
          ) : isLoading ? (
            <p className="flex flex-col items-center  text-center py-8">
              <CircleNotchIcon className="h-6 w-6 text-neutral-500" />
              <p className="text-sm text-muted-foreground">Loading passengers...</p>
            </p>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Failed to load passengers for this trip.
              </p>
              <Button variant="submit" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : !bookings || bookings.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <UsersIcon className="h-6 w-6 text-neutral-500" />
              <p className="text-sm text-muted-foreground ">No passengers booked yet.</p>
            </div>
          ) : (
            bookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 transition-colors hover:bg-neutral-100"
              >
                <div className="flex items-center gap-3">
                  {/* use an avatar here */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-neutral-600">
                    {booking.user?.firstName?.[0] || "?"}
                    {booking.user?.lastName?.[0] || ""}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {booking.user
                        ? `${booking.user.firstName} ${booking.user.lastName}`
                        : "Passenger details unavailable"}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
