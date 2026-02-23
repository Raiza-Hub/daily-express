"use client"


import {
    Avatar,
    AvatarImage
} from "@repo/ui/components/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { CreditCardIcon, QuestionIcon, SignOutIcon } from "@phosphor-icons/react"
// import type { User } from '@workos-inc/node'
import { useRouter } from "next/navigation"
// import FeedbackDialog from "./FeedbackDialog"


const user = {
    id: "usr_9f8a7b6c",
    firstName: "Daniel",
    lastName: "Okafor",
    email: "daniel.okafor24@example.com",
    profilePictureUrl: "https://images.unsplash.com/photo-1617244147030-8bd6f9e21d1e?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    createdAt: "2024-05-12T10:24:00Z",
};

export function UserAccountNav() {
    const router = useRouter();

    const signOut = () => {
        console.log("User signed out");
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarImage className="object-cover" src={user.profilePictureUrl || ""} alt={`${user.firstName} ${user.lastName}`} />
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-54 rounded-lg"
                align="end"
                sideOffset={10}
            >
                <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <Avatar className="h-8 w-8">
                            <AvatarImage className="object-cover" src={user.profilePictureUrl || ""} alt={`${user.firstName} ${user.lastName}`} />
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-medium">{`${user.firstName} ${user.lastName ?? ""}`}</span>
                            <span className="text-muted-foreground truncate text-xs">
                                {user.email}
                            </span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    {/* <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/account")}>
                        <UserIcon weight="bold" className="w-5 h-5" />
                        Account
                    </DropdownMenuItem> */}
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => router.push("/billing")}>
                        <CreditCardIcon weight="bold" className="w-5 h-5" />
                        Billing
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <a
                            href="mailto:support@yourdomain.com"
                            className="flex items-center gap-2 cursor-pointer"
                        >
                            <QuestionIcon weight="bold" className="w-5 h-5" />
                            Support
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        {/* <FeedbackDialog /> */}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={signOut}
                    className="cursor-pointer"
                >
                    <SignOutIcon className="w-5 h-5" weight="bold" />
                    Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
