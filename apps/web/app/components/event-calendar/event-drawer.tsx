"use client";

import { format } from "date-fns";
import { BadgeCheck, Clock, Loader2, XCircle, type LucideIcon } from "lucide-react";
import {
  useGetTripPassengers,
  useInitiateTripPayout,
  useCancelTrip,
} from "@repo/api";
import { toast } from "sonner";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@repo/ui/Drawer";
import { cn } from "@repo/ui/lib/utils";

import { Button } from "~/components/ui/button";
import type {
  CalendarEvent,
  EventStatus,
} from "~/components/event-calendar/types";
import { EventPassengerListItem } from "~/components/event-calendar/event-passenger-list-item";

interface EventDrawerProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS: Record<
  EventStatus,
  { Icon?: LucideIcon; label: string; className: string }
> = {
  pending: { Icon: Clock, label: "Pending", className: "text-amber-600 dark:text-amber-400" },
  successful: { label: "Successful", className: "text-blue-600 dark:text-blue-400" },
  cancelled: { Icon: XCircle, label: "Cancelled", className: "text-red-600 dark:text-red-400" },
};

function EventStatusBadge({ status }: { status: EventStatus }) {
  const { Icon, label, className } = STATUS_OPTIONS[status];
  return (
    <span className="flex items-center gap-1.5">
      {status === "successful" ? (
        <BadgeCheck aria-hidden className="h-5 w-5 shrink-0 fill-blue-500 text-white" />
      ) : (
        Icon && <Icon aria-hidden className={cn("h-4 w-4 shrink-0", className)} />
      )}
      <span className={cn("text-sm font-medium", className)}>{label}</span>
    </span>
  );
}

const formatDateTime = (event: CalendarEvent) => {
  const start = new Date(event.start);
  const dateLabel = format(start, "MMM d, yyyy");
  const timeLabel = format(start, "h:mm a");
  return { dateLabel, timeLabel };
};

export function EventDrawer({
  event,
  isOpen,
  onClose,
}: EventDrawerProps) {
  const { data, isPending: isLoadingPassengers } = useGetTripPassengers(
    event?.id ?? "",
    { enabled: isOpen && !!event?.id },
  );

  const initiatePayout = useInitiateTripPayout({
    onSuccess: () => {
      toast.success("Payout initiated successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to initiate payout");
    },
  });

  const cancelTrip = useCancelTrip({
    onSuccess: () => {
      toast.success("Trip cancelled and refunds initiated!");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to cancel trip");
    },
  });

  if (!event) return null;

  const { dateLabel, timeLabel } = formatDateTime(event);
  const passengers = data?.passengers ?? [];

  const canWithdraw =
    event.tripStatus === "completed" && event.status !== "successful";
  const canCancel =
    event.tripStatus !== "completed" && event.tripStatus !== "cancelled";

  return (
    <Drawer onOpenChange={(open) => !open && onClose()} open={isOpen}>
      <DrawerContent>
        <div className="mx-auto flex min-h-0 w-full max-w-lg flex-col">
          <DrawerHeader className="sm:text-left">
            <DrawerTitle>
              {event.origin} → {event.destination}
            </DrawerTitle>
            <DrawerDescription className="font-medium">
              {dateLabel} • {timeLabel}
            </DrawerDescription>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <div className="flex flex-col gap-6">
              <EventStatusBadge status={event.status} />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Price
                </span>
                <span className="text-lg font-bold text-foreground">
                  ₦{event.price.toLocaleString("en-NG")}
                </span>
              </div>

              <div>
                <p className="mb-3 text-base font-semibold text-foreground">
                  Passengers
                </p>
                {isLoadingPassengers ? (
                  <div className="flex flex-col gap-3">
                    <div className="h-14 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" />
                    <div className="h-14 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" />
                  </div>
                ) : passengers.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {passengers.map((passenger) => (
                      <EventPassengerListItem
                        key={passenger.id}
                        passenger={passenger}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No passengers on this trip.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DrawerFooter className="flex-row flex-nowrap items-center justify-center gap-2">
            <Button
              className="flex-1 font-semibold text-sm gap-2"
              disabled={!canWithdraw || initiatePayout.isPending}
              onClick={() => initiatePayout.mutate({ id: event.id })}
              pill
              title={
                canWithdraw
                  ? undefined
                  : "Complete this trip before you can withdraw"
              }
              type="button"
            >
              {initiatePayout.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Withdraw
            </Button>
            <Button
              className="flex-1 bg-red-600 font-semibold text-sm text-white hover:bg-red-500 disabled:opacity-50 gap-2"
              disabled={!canCancel || cancelTrip.isPending}
              onClick={() => cancelTrip.mutate({ id: event.id })}
              pill
              type="button"
            >
              {cancelTrip.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Cancel
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
