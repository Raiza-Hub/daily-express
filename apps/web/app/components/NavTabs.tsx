"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarProfileIcon, PathIcon, type Icon } from "@phosphor-icons/react";
import { cn } from "@repo/ui/lib/utils";

const tabs: { name: string; href: string; icon: Icon }[] = [
    { name: "Book a trip", href: "/", icon: CarProfileIcon },
    { name: "Trip status", href: "/trip-status", icon: PathIcon },
    // { name: "Accounts", href: "/settings/accounts" },
    // { name: "Bank Details", href: "/settings/bank-details" },
    // { name: "Preferences", href: "/settings/preferences" },
    // { name: "Team", href: "/settings/team" },
    // { name: "API Keys & Webhooks", href: "/settings/api-keys" },
];

const NavTabs = () => {
    const pathname = usePathname();

    return (
        <div className="mx-auto w-full max-w-7xl px-4">
            <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href;
                    const TabIcon = tab.icon;

                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            className={cn(
                                "text-sm inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-4 px-1 font-medium transition-colors duration-200",
                                isActive
                                    ? "border-blue-500 text-blue-600"
                                    : "border-transparent text-black hover:border-gray-300 hover:text-gray-700"
                            )}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <TabIcon size={20} />
                            {tab.name}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
};

export default NavTabs;
