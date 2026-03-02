"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretDownIcon, ListIcon, XIcon } from "@phosphor-icons/react";
import NavItem from "./NavItem";
import CreateRouteDialog from "./CreateRouteDialog";
import { Icons } from "@repo/ui/Icons";
import { cn } from "@repo/ui/lib/utils";

const SETTINGS_TABS = [
    { name: "Profile", href: "/settings/profile" },
    { name: "Accounts", href: "/settings/accounts" },
    { name: "Bank Details", href: "/settings/bank-details" },
];

const MobileNav = () => {
    const [open, setOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const pathname = usePathname();
    const isSettingsActive = pathname.startsWith("/settings");

    const closeMenu = () => {
        setOpen(false);
        setSettingsOpen(false);
    };


    return (
        <>
            {/* Hamburger button */}
            <button
                onClick={() => setOpen((prev) => !prev)}
                className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors lg:hidden cursor-pointer"
                aria-label="Open navigation menu"
            >
                <ListIcon size={18} weight="bold" />
            </button>

            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
                    onClick={closeMenu}
                />
            )}

            {/* Top-sliding panel — starts from top-0 */}
            <div
                className={cn(
                    "fixed top-0 left-0 right-0 z-50 bg-background border-b border-neutral-200 shadow-lg lg:hidden",
                    "transition-all duration-300 ease-in-out overflow-hidden",
                    open ? "max-h-screen opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                )}
            >
                {/* Header: logo + close button */}
                <div className="flex items-center justify-between px-4 h-16 border-b border-neutral-100">
                    <Link href="/" onClick={closeMenu}>
                        <Icons.logo className="h-10 w-10" />
                    </Link>
                    <button
                        onClick={closeMenu}
                        className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        aria-label="Close navigation menu"
                    >
                        <XIcon size={20} weight="bold" />
                    </button>
                </div>

                {/* Nav links */}
                <nav className="flex flex-col gap-1 px-4 py-4">
                    <NavItem
                        label="Payouts"
                        href="/payouts"
                        className="text-base py-2"
                        onClick={closeMenu}
                    />

                    {/* Settings — expandable */}
                    <div>
                        <button
                            onClick={() => setSettingsOpen((prev) => !prev)}
                            aria-expanded={settingsOpen}
                            aria-controls="mobile-settings-submenu"
                            className={cn(
                                "w-full flex items-center justify-between px-2 py-2 text-base font-medium rounded-md transition-colors cursor-pointer",
                                isSettingsActive
                                    ? "text-foreground bg-muted"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                        >
                            Settings
                            <CaretDownIcon
                                size={16}
                                className={cn(
                                    "transition-transform duration-200",
                                    settingsOpen ? "rotate-180" : "rotate-0"
                                )}
                            />
                        </button>

                        {settingsOpen && (
                            <div id="mobile-settings-submenu" className="mt-1 ml-3 flex flex-col gap-0.5 border-l border-neutral-200 pl-3">
                                {SETTINGS_TABS.map((tab) => {
                                    const isActive = pathname === tab.href;
                                    return (
                                        <Link
                                            key={tab.href}
                                            href={tab.href}
                                            onClick={closeMenu}
                                            className={cn(
                                                "relative px-3 py-2 text-sm rounded-md transition-colors",
                                                isActive
                                                    ? "text-blue-600 font-medium before:absolute before:left-[-13px] before:top-0 before:bottom-0 before:w-0.5 before:bg-blue-500 before:rounded-full"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                            )}
                                        >
                                            {tab.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </nav>

                {/* Create Route button */}
                <div className="px-4 pb-5">
                    <CreateRouteDialog />
                </div>
            </div>
        </>
    );
};

export default MobileNav;
