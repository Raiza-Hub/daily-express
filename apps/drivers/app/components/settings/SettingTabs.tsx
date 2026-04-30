"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
    { name: "Profile", href: "/settings/profile" },
    { name: "Accounts", href: "/settings/accounts" },
    { name: "Bank Details", href: "/settings/bank-details" },
];

const SettingNavTabs = () => {
    const pathname = usePathname();

    return (
        <div className="hidden lg:block w-full border-b border-neutral-200 px-6">
            <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href;
                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            className={`
                                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors duration-200
                                ${isActive
                                    ? "border-blue-500 text-blue-600"
                                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                                }
                            `}
                            aria-current={isActive ? "page" : undefined}
                        >
                            {tab.name}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
};

export default SettingNavTabs;
