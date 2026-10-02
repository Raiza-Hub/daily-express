import {
  BadgeCheck,
  Hourglass,
  RotateCcw,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { STATUS_LABELS, type TripBookingStatus } from "~/lib/trip-bookings";

const STATUS_BADGES: Record<
  TripBookingStatus,
  { Icon: LucideIcon; className: string }
> = {
  confirmed: { Icon: BadgeCheck, className: "text-blue-600 dark:text-blue-400" },
  refunded: { Icon: RotateCcw, className: "text-green-600 dark:text-green-400" },
  refund_pending: {
    Icon: Hourglass,
    className: "text-amber-600 dark:text-amber-400",
  },
  refund_failed: {
    Icon: TriangleAlert,
    className: "text-red-600 dark:text-red-400",
  },
};

function BookingStatusBadge({ status }: { status: TripBookingStatus }) {
  const { Icon, className } = STATUS_BADGES[status];
  const isConfirmed = status === "confirmed";
  return (
    <span className="flex items-center gap-1.5">
      <Icon
        aria-hidden
        className={cn(
          "shrink-0",
          isConfirmed
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

export { BookingStatusBadge };