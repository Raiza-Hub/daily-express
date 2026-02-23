
import { DotsThreeVerticalIcon, NotePencilIcon, TrashIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { Button } from "@repo/ui/components/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";


export default function RouteCardActionMenu() {
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button size="icon-lg" variant="ghost">
                    <DotsThreeVerticalIcon weight="bold" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        {/* <EditRouteSheet
                            defaultValues={{
                                departureCity: "Lagos",
                                arrivalCity: "Abuja",
                                vehicleType: "car",
                                seatNumber: 8,
                                priceWithoutLuggage: 844328,
                                priceWithLuggage: 900000,
                                departureTime: new Date('2026-02-10T15:30:00'),
                                estimatedArrivalTime: new Date('2026-02-11T09:43:00'),
                            }}
                        /> */}
                        <NotePencilIcon size={18} />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <UsersThreeIcon size={18} />
                        Passengers
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive">
                        <TrashIcon aria-hidden="true" size={16} />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
