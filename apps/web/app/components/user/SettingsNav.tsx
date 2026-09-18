"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLogout } from "@repo/api";
import { Drama, LogOut, Settings, TriangleAlert, UserRound } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "~/components/ui/button";

const NAV_LINKS = [
    { href: "/settings/profile", label: "Profile", icon: UserRound },
    { href: "/settings/driver", label: "Driver", icon: Drama },
    { href: "/settings/danger", label: "Danger zone", icon: TriangleAlert, danger: true },
] as const;

const SettingsNav = () => {
    const pathname = usePathname();
    const router = useRouter();
    const logout = useLogout();

    const handleSignOut = () => {
        logout.mutate(undefined, {
            onSuccess: () => {
                router.push("/");
            },
        });
    };

    return (
        <nav className="flex h-max flex-col gap-3">
            <div className="flex items-center gap-2 px-3">
                <Settings aria-hidden="true" className="h-4 w-4 shrink-0" />
                <p className="text-base font-semibold">Settings</p>
            </div>
            <div className="flex flex-col gap-1">
                {NAV_LINKS.map(({ href, label, icon: Icon, ...rest }) => {
                    const active = pathname === href;
                    const isDanger = "danger" in rest && rest.danger === true;
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                active
                                    ? isDanger
                                        ? "bg-card text-red-600"
                                        : "bg-card text-foreground"
                                    : isDanger
                                        ? "text-red-600 hover:text-red-700"
                                        : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            {label}
                        </Link>
                    );
                })}
            </div>
            <div className="mt-6 flex justify-start pt-5">
                <Button
                    type="button"
                    pill
                    onClick={handleSignOut}
                    className="bg-red-600 font-semibold text-sm text-white hover:bg-red-700"
                    disabled={logout.isPending}
                >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Sign out
                </Button>
            </div>
        </nav>
    );
};

export { SettingsNav };
