"use client";

import { useState } from "react";
import Link from "next/link";
import { ListIcon, XIcon } from "@phosphor-icons/react";
import NavItem from "./NavItem";
import CreateRouteDialog from "./CreateRouteDialog";
import { Icons } from "@repo/ui/Icons";

const MobileNav = () => {
    const [open, setOpen] = useState(false);

    return (
        <>
            {/* Hamburger button */}
            <button
                onClick={() => setOpen((prev) => !prev)}
                className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors lg:hidden"
                aria-label="Open navigation menu"
            >
                <ListIcon size={18} weight="bold" />
            </button>

            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Top-sliding panel — starts from top-0 */}
            <div
                className={`fixed top-0 left-0 right-0 z-50 bg-background border-b border-neutral-200 shadow-lg lg:hidden
                    transition-all duration-300 ease-in-out overflow-hidden
                    ${open ? "max-h-screen opacity-100" : "max-h-0 opacity-0 pointer-events-none"}`}
            >
                {/* Header: logo + close button */}
                <div className="flex items-center justify-between px-4 h-16 border-b border-neutral-100">
                    <Link href="/" onClick={() => setOpen(false)}>
                        <Icons.logo className="h-10 w-10" />
                    </Link>
                    <button
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
                        className="text-base py-3"
                        onClick={() => setOpen(false)}
                    />
                    <NavItem
                        label="Settings"
                        href="/settings/profile"
                        className="text-base py-3"
                        onClick={() => setOpen(false)}
                    />
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
