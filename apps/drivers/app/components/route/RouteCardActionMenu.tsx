import {
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
  onStopBooking: () => void;
  stopBookingDisabled?: boolean;
  stopBookingLabel?: string;
}

export default function RouteCardActionMenu({
  onPassengers,
  onStopBooking,
  stopBookingDisabled = false,
  stopBookingLabel = "Stop Booking",
}: RouteCardActionMenuProps) {
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);

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
            variant="destructive"
            className="cursor-pointer text-red-600 focus:text-red-600 hover:text-red-600 data-[disabled]:text-red-400"
            disabled={stopBookingDisabled}
            onSelect={onStopBooking}
          >
            <ProhibitIcon aria-hidden="true" size={16} />
            {stopBookingLabel}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
