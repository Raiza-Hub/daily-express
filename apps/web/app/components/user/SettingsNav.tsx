"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    motion,
    useMotionValueEvent,
    useReducedMotion,
    useScroll,
    type Transition,
} from "framer-motion";
import { useLogout } from "@repo/api";
import { Drama, LogOut, Settings, TriangleAlert, UserRound } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "~/components/ui/button";

const NAV_LINKS = [
    { href: "/settings/profile", label: "Profile", icon: UserRound },
    { href: "/settings/driver", label: "Driver", icon: Drama },
    { href: "/settings/danger", label: "Danger zone", icon: TriangleAlert, danger: true },
] as const;

const HIDE_AFTER_PX = 150;
const navTransition: Transition = { duration: 0.25, ease: "easeOut" };

const linkClassName = (active: boolean, isDanger: boolean) =>
    cn(
        "flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
            ? isDanger
                ? "bg-card text-red-600"
                : "bg-card text-foreground"
            : isDanger
                ? "text-red-600 hover:text-red-700"
                : "text-muted-foreground hover:text-foreground",
    );

const SettingsNav = () => {
    const pathname = usePathname();
    const router = useRouter();
    const logout = useLogout();

    const prefersReducedMotion = useReducedMotion();
    const { scrollY } = useScroll();
    const [isDesktop, setIsDesktop] = useState(false);
    const [isHidden, setIsHidden] = useState(false);

    useMotionValueEvent(scrollY, "change", (current) => {
        const previous = scrollY.getPrevious() ?? 0;
        setIsHidden(current > previous && current > HIDE_AFTER_PX);
    });

    useEffect(() => {
        const query = window.matchMedia("(min-width: 768px)");
        const sync = () => setIsDesktop(query.matches);
        sync();
        query.addEventListener("change", sync);
        return () => query.removeEventListener("change", sync);
    }, []);

    const handleSignOut = () => {
        logout.mutate(undefined, {
            onSuccess: () => {
                router.push("/");
            },
        });
    };

    return (
        <motion.nav
            aria-label="Settings"
            onFocusCapture={() => setIsHidden(false)}
            animate={{
                y: !isDesktop && !prefersReducedMotion && isHidden ? "-100%" : 0,
            }}
            transition={navTransition}
            className="sticky top-0 z-40 -mx-4 min-w-0 border-b border-border bg-background px-4 pt-3 sm:-mx-6 sm:px-6 md:static md:z-auto md:mx-0 md:border-b-0 md:bg-transparent md:px-0"
        >
            <div className="flex items-center gap-2 pb-2 md:px-3 md:pb-3">
                <Settings aria-hidden="true" className="h-4 w-4 shrink-0" />
                <p className="text-base font-semibold">Settings</p>
            </div>

            <div
                role="group"
                aria-label="Settings sections"
                tabIndex={0}
                className="-mx-4 flex snap-x snap-mandatory gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 md:mx-0 md:flex-col md:snap-none md:overflow-visible md:px-0 md:pb-0"
            >
                {NAV_LINKS.map(({ href, label, icon: Icon, ...rest }) => {
                    const active = pathname === href;
                    const isDanger = "danger" in rest && rest.danger === true;
                    return (
                        <Link
                            key={href}
                            href={href}
                            aria-current={active ? "page" : undefined}
                            className={linkClassName(active, isDanger)}
                        >
                            <Icon
                                aria-hidden="true"
                                className="hidden h-4 w-4 shrink-0 md:block"
                            />
                            {label}
                        </Link>
                    );
                })}

                <div className="ml-2 shrink-0 snap-start border-l border-border pl-2 md:ml-0 md:mt-5 md:border-l-0 md:pl-0">
                    <Button
                        type="button"
                        pill
                        onClick={handleSignOut}
                        className="h-8 bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 md:h-10 md:px-4 md:py-2 md:text-sm"
                        disabled={logout.isPending}
                    >
                        <LogOut
                            aria-hidden="true"
                            className="hidden h-4 w-4 shrink-0 md:block"
                        />
                        Sign out
                    </Button>
                </div>
            </div>
        </motion.nav>
    );
};

export { SettingsNav };
