import {
  CheckCircleIcon,
  DotsThreeVerticalIcon,
  ProhibitIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { useBodyScrollLock } from "@repo/ui/hooks/use-body-scroll-lock";
import { useState } from "react";

interface RouteCardActionMenuProps {
  onPassengers: () => void;
  onTripAction: () => void;
  tripActionDisabled?: boolean;
  tripActionLabel?: string;
  tripActionMode?: "stop_booking" | "complete";
}

export default function RouteCardActionMenu({
  onPassengers,
  onTripAction,
  tripActionDisabled = false,
  tripActionLabel = "Stop Booking",
  tripActionMode = "stop_booking",
}: RouteCardActionMenuProps) {
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);
  const isCompletionAction = tripActionMode === "complete";
  const TripActionIcon = isCompletionAction ? CheckCircleIcon : ProhibitIcon;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button size="icon-lg" variant="ghost" className="cursor-pointer">
          <DotsThreeVerticalIcon weight="bold" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer" onSelect={onPassengers}>
            <UsersThreeIcon size={18} />
            Passengers
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant={isCompletionAction ? "default" : "destructive"}
            className={
              isCompletionAction
                ? "cursor-pointer text-emerald-700 focus:text-emerald-700 hover:text-emerald-700 data-[disabled]:text-emerald-400"
                : "cursor-pointer text-red-600 focus:text-red-600 hover:text-red-600 data-[disabled]:text-red-400"
            }
            disabled={tripActionDisabled}
            onSelect={onTripAction}
          >
            <TripActionIcon aria-hidden="true" size={16} />
            {tripActionLabel}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
