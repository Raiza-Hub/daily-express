"use client";

import { format, parse } from "date-fns";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@repo/ui/Drawer";
import { useGetTripPassengers, type UserBookingWithTrip } from "@repo/api";
import { BookingStatusBadge } from "./booking-status-badge";
import { PassengerSection } from "./passenger-section";
import { getInitials } from "../user/settings-shared";
import { formatTripTime } from "~/lib/trip";
import {
  deriveTripBookingStatus,
  remainingPassengerCopy,
} from "~/lib/trip-bookings";
import Image from "next/image";

interface BookingDetailsDrawerProps {
  booking: UserBookingWithTrip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BookingDetailsDrawer({
  booking,
  open,
  onOpenChange,
}: BookingDetailsDrawerProps) {
  const tripId = booking?.tripId ?? "";

  const { data, isPending, isError } = useGetTripPassengers(tripId, {
    enabled: open,
  });

  if (!booking) return null;

  const trip = booking.trip;
  const originTitle = trip?.origin?.title ?? "Unknown origin";
  const destinationTitle = trip?.destination?.title ?? "Unknown destination";
  const dateLabel = format(
    parse(booking.tripDate, "yyyy-MM-dd", new Date()),
    "MMM d, yyyy",
  );
  const departureLabel = formatTripTime(booking.departureTime);
  const status = deriveTripBookingStatus(booking.refundStatus);
  const totalPaid = booking.totalAmount + booking.totalFee;
  const driver = trip?.driver ?? null;
  const remainingCopy =
    driver || !trip ? null : remainingPassengerCopy(trip.capacity, trip.bookedSeats);
  const driverName = driver
    ? `${driver.firstName} ${driver.lastName}`.trim()
    : "";
  const passengers = data?.passengers ?? [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto flex min-h-0 w-full max-w-lg flex-col">
          <DrawerHeader className="sm:text-left">
            <DrawerTitle>
              {originTitle} → {destinationTitle}
            </DrawerTitle>
            <DrawerDescription className="font-medium">
              {dateLabel} • {departureLabel}
            </DrawerDescription>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <BookingStatusBadge status={status} />
                {remainingCopy ? (
                  <p className="text-sm text-muted-foreground">
                    {remainingCopy}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total paid
                </span>
                <span className="text-lg font-bold text-foreground">
                  ₦{totalPaid.toLocaleString("en-NG")}
                </span>
              </div>

              <PassengerSection
                passengers={passengers}
                isPending={isPending}
                isError={isError}
              />

              {driver ? (
                <div className="flex items-center justify-between border-t border-neutral-200 pt-5 dark:border-neutral-800">
                  {driver.profilePic ? (
                    <Image
                      src={driver.profilePic}
                      alt={`${driverName}'s profile`}
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold text-muted-foreground">
                      {getInitials(driverName)}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1 px-3">
                    <span className="truncate text-base font-semibold text-foreground">
                      {driverName}
                    </span>
                    <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      {driver.phone}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    Driver
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <DrawerFooter>
            <DrawerClose className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-8 font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              Close
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export { BookingDetailsDrawer };