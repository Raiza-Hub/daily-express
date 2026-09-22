"use client";

import { useEffect, useState } from "react";
import { format, parse } from "date-fns";
import {
  BadgeCheck,
  Clock,
  PhoneCall,
  RotateCcw,
  TriangleAlert,
  UserLock,
  type LucideIcon,
} from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@repo/ui/Drawer";
import { cn } from "@repo/ui/lib/utils";
import { PassengerListItem } from "./passenger-list-item";
import { getInitials } from "../user/settings-shared";
import { formatTripTime } from "~/lib/trip";
import {
  STATUS_LABELS,
  type BookingStatus,
  type BookingPassenger,
  type TripBooking,
} from "~/lib/trip-bookings";
import Image from "next/image";

const STATUS_BADGES: Record<
  BookingStatus,
  { Icon: LucideIcon; className: string }
> = {
  awaiting_passengers: {
    Icon: Clock,
    className: "text-amber-600 dark:text-amber-400",
  },
  awaiting_driver: {
    Icon: PhoneCall,
    className: "text-orange-600 dark:text-orange-400",
  },
  driver_accepted: {
    Icon: UserLock,
    className: "text-blue-600 dark:text-blue-400",
  },
  completed: { Icon: BadgeCheck, className: "text-blue-600 dark:text-blue-400" },
  refunded: { Icon: RotateCcw, className: "text-green-600 dark:text-green-400" },
  refund_failed: { Icon: TriangleAlert, className: "text-red-600 dark:text-red-400" },
};

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { Icon, className } = STATUS_BADGES[status];
  const isCompleted = status === "completed";
  return (
    <span className="flex items-center gap-1.5">
      <Icon
          aria-hidden
          className={cn(
            "shrink-0",
            isCompleted
              ? "h-5 w-5 fill-blue-500 text-white"
              : cn("h-4 w-4", className),
          )}
        />
      <span className={cn("text-sm font-medium", className)}>
        {STATUS_LABELS[status]}
      </span>
    </span>
  );
}

interface BookingDetailsDrawerProps {
  booking: TripBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BookingDetailsDrawer({
  booking,
  open,
  onOpenChange,
}: BookingDetailsDrawerProps) {
  const [passengers, setPassengers] = useState<BookingPassenger[]>([]);

  useEffect(() => {
    if (open && booking) {
      setPassengers(booking.passengers);
    }
  }, [open, booking]);

  if (!booking) return null;

  const dateLabel = format(
    parse(booking.tripDate, "yyyy-MM-dd", new Date()),
    "MMM d, yyyy",
  );
  const departureLabel = formatTripTime(booking.departureTime);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto flex min-h-0 w-full max-w-lg flex-col">
          <DrawerHeader className="sm:text-left">
            <DrawerTitle>
              {booking.origin} → {booking.destination}
            </DrawerTitle>
            <DrawerDescription className="font-medium">
              {dateLabel} • {departureLabel}
            </DrawerDescription>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <div className="flex flex-col gap-6">
              <BookingStatusBadge status={booking.status} />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Price
                </span>
                <span className="text-lg font-bold text-foreground">
                  ₦{booking.price.toLocaleString("en-NG")}
                </span>
              </div>

              <div>
                <p className="mb-3 text-base font-semibold text-foreground">
                  Passengers
                </p>
                {passengers.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {passengers.map((passenger) => (
                      <PassengerListItem
                        key={passenger.id}
                        passenger={passenger}
                        onRemove={() =>
                          setPassengers((current) =>
                            current.filter((item) => item.id !== passenger.id),
                          )
                        }
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No passengers on this booking.
                  </p>
                )}
              </div>

              {booking.driver ? (
                <div className="flex items-center justify-between border-t border-neutral-200 pt-5 dark:border-neutral-800">
                  {booking.driver.profileImage ? (
                    <Image
                      src={booking.driver.profileImage}
                      alt={`${booking.driver.name}'s profile`}
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold text-muted-foreground">
                      {getInitials(booking.driver.name)}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1 px-3">
                    <span className="truncate text-base font-semibold text-foreground">
                      {booking.driver.name}
                    </span>
                    <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      {booking.driver.phone}
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
