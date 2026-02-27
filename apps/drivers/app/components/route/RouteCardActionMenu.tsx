
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

interface RouteCardActionMenuProps {
    onEdit: () => void;
    onPassengers: () => void;
    onDelete: () => void;
}

export default function RouteCardActionMenu({ onEdit, onPassengers, onDelete }: RouteCardActionMenuProps) {
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button size="icon-lg" variant="ghost" className="cursor-pointer">
                    <DotsThreeVerticalIcon weight="bold" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                    <DropdownMenuItem className="cursor-pointer" onSelect={onEdit}>
                        <NotePencilIcon size={18} />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onSelect={onPassengers}>
                        <UsersThreeIcon size={18} />
                        Passengers
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" className="cursor-pointer" onSelect={onDelete}>
                        <TrashIcon aria-hidden="true" size={16} />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
