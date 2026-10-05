export type NavIconName =
    | "car"
    | "calendarDays"
    | "mapPin"
    | "settings"
    | "sparkles"
    | "info"
    | "helpCircle";

export interface NavLink {
    href: string;
    label: string;
    icon: NavIconName;
}

export const MARKETING_NAV_LINKS: readonly NavLink[] = [
    { href: "/#how-it-works", label: "How It Works", icon: "sparkles" },
    { href: "/#faq", label: "About Us", icon: "info" },
    { href: "/#faq", label: "FAQ", icon: "helpCircle" },
];

export const DRIVER_CALENDAR_HREF = "/driver/calendar";

export const APP_NAV_LINKS: readonly NavLink[] = [
    { href: "/trip/new", label: "Book a Trip", icon: "car" },
    { href: "/trip/bookings", label: "My Bookings", icon: "calendarDays" },
    { href: DRIVER_CALENDAR_HREF, label: "Driver Calendar", icon: "mapPin" },
    { href: "/settings/profile", label: "Settings", icon: "settings" },
];

const ctaClassName =
    "inline-flex w-full items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition-colors lg:w-auto";

export const driverCtaClassName = `${ctaClassName} border border-neutral-300 text-neutral-700 hover:bg-neutral-50`;

export const signInClassName = `${ctaClassName} bg-neutral-900 text-white hover:bg-neutral-800`;
