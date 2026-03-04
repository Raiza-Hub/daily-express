"use client"

import { useState } from "react"
import {
    Avatar,
    AvatarImage,
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
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetTrigger,
} from "@repo/ui/components/sheet"
import { useIsMobile } from "@repo/ui/hooks/use-is-mobile"

export interface UserAccountNavUser {
    firstName: string
    lastName?: string
    email: string
    profilePictureUrl?: string
}

export interface UserAccountNavMenuItem {
    /** Unique key for the item */
    key: string
    /** Icon element to render */
    icon: React.ReactNode
    /** Label text */
    label: string
    /** Href — renders as an <a> tag if provided, otherwise a <button> */
    href?: string
    /** onClick handler */
    onClick?: () => void
    /** If true, renders with destructive/danger styling */
    destructive?: boolean
}

export interface UserAccountNavProps {
    user: UserAccountNavUser
    /** Menu items rendered in the main group */
    menuItems?: UserAccountNavMenuItem[]
    /** Items rendered in a separate group at the bottom (e.g. Sign out) */
    footerItems?: UserAccountNavMenuItem[]
    /** Whether to show the mobile Sheet variant. Defaults to auto-detect via useIsMobile. */
    forceMobile?: boolean
}

// ── Shared sub-components ────────────────────────────────────────────────────

function UserInfoContent({ user }: { user: UserAccountNavUser }) {
    return (
        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8">
                <AvatarImage
                    className="object-cover"
                    src={user.profilePictureUrl || ""}
                    alt={`${user.firstName} ${user.lastName ?? ""}`}
                />
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                    {`${user.firstName} ${user.lastName ?? ""}`}
                </span>
                <span className="text-muted-foreground truncate text-sm md:text-xs">
                    {user.email}
                </span>
            </div>
        </div>
    )
}


// ── Main component ────────────────────────────────────────────────────────────

/**
 * A responsive user account navigation component.
 *
 * - **Mobile**: renders a right-side Sheet with avatar trigger.
 * - **Desktop**: renders a Dropdown anchored to the avatar trigger.
 *
 * @example
 * ```tsx
 * <UserAccountNav
 *   user={currentUser}
 *   menuItems={[
 *     { key: "profile", icon: <UserIcon />, label: "Profile", onClick: () => router.push("/settings/profile") },
 *     { key: "support", icon: <QuestionIcon />, label: "Support", href: "mailto:support@yourdomain.com" },
 *   ]}
 *   footerItems={[
 *     { key: "signout", icon: <SignOutIcon />, label: "Log out", onClick: handleSignOut },
 *   ]}
 * />
 * ```
 */
export function UserAccountNav({
    user,
    menuItems = [],
    footerItems = [],
    forceMobile,
}: UserAccountNavProps) {
    const detectedMobile = useIsMobile()
    const isMobile = forceMobile ?? detectedMobile
    const [sheetOpen, setSheetOpen] = useState(false)

    const renderItem = (
        item: UserAccountNavMenuItem,
        variant: "sheet" | "dropdown"
    ) => {
        const isSheet = variant === "sheet"

        if (item.href) {
            return isSheet ? (
                <a
                    key={item.key}
                    href={item.href}
                    className="flex items-center gap-3 px-2 py-2 text-sm text-foreground hover:bg-muted transition-colors rounded-lg"
                >
                    <span className="w-4 h-4 text-muted-foreground flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">
                        {item.icon}
                    </span>
                    {item.label}
                </a>
            ) : (
                <DropdownMenuItem key={item.key} asChild>
                    <a href={item.href} className="flex items-center gap-2 cursor-pointer">
                        <span className="w-4 h-4 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">
                            {item.icon}
                        </span>
                        {item.label}
                    </a>
                </DropdownMenuItem>
            )
        }

        return isSheet ? (
            <button
                key={item.key}
                onClick={() => {
                    item.onClick?.()
                    setSheetOpen(false)
                }}
                className="flex items-center gap-3 px-2 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer w-full text-left rounded-lg"
            >
                <span className="w-4 h-4 text-muted-foreground flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">
                    {item.icon}
                </span>
                {item.label}
            </button>
        ) : (
            <DropdownMenuItem
                key={item.key}
                onClick={item.onClick}
                className="cursor-pointer"
            >
                <span className="w-4 h-4 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">
                    {item.icon}
                </span>
                {item.label}
            </DropdownMenuItem>
        )
    }

    // ── Mobile: Sheet ─────────────────────────────────────────────────────────
    if (isMobile) {
        return (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger>
                    <Avatar className="h-8 w-8 cursor-pointer">
                        <AvatarImage
                            className="object-cover"
                            src={user.profilePictureUrl || ""}
                            alt={`${user.firstName} ${user.lastName ?? ""}`}
                        />
                    </Avatar>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-full gap-1.5">
                    <SheetHeader className="px-2 pb-0">
                        <SheetTitle className="sr-only">Account</SheetTitle>
                        <SheetDescription className="sr-only">Account menu</SheetDescription>
                        <UserInfoContent user={user} />
                    </SheetHeader>

                    {menuItems.length > 0 && (
                        <>
                            <div className="border-t border-border" />
                            <div className="flex flex-col px-2">
                                {menuItems.map((item) => renderItem(item, "sheet"))}
                            </div>
                        </>
                    )}

                    {footerItems.length > 0 && (
                        <>
                            <div className="border-t border-border" />
                            <div className="flex flex-col px-2">
                                {footerItems.map((item) => renderItem(item, "sheet"))}
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        )
    }

    // ── Desktop: Dropdown ─────────────────────────────────────────────────────
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarImage
                        className="object-cover"
                        src={user.profilePictureUrl || ""}
                        alt={`${user.firstName} ${user.lastName ?? ""}`}
                    />
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-54 rounded-lg"
                align="end"
                sideOffset={10}
            >
                <DropdownMenuLabel className="p-0 font-normal">
                    <UserInfoContent user={user} />
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {menuItems.length > 0 && (
                    <DropdownMenuGroup>
                        {menuItems.map((item) => renderItem(item, "dropdown"))}
                    </DropdownMenuGroup>
                )}
                {footerItems.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        {footerItems.map((item) => renderItem(item, "dropdown"))}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

UserAccountNav.displayName = "UserAccountNav"
