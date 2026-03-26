"use client";

import { CarProfileIcon, VanIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TripDetailsSheet from "./TripDetailsSheet";
import type { TRoute } from "@repo/types/routeSchema";
import dayjs from "dayjs";
import { PlaneDots } from "@repo/ui/PlaneDots";
import { formatPrice } from "@repo/ui/lib/utils";
import { DriverInfo } from "~/components/trip/DriverInfo";
import type { DriverInfoProps } from "~/components/trip/DriverInfo";

export interface TripStatusItem {
    id: string;
    trip: TRoute;
    driver?: DriverInfoProps;
    bookingRef: string;
    passengerLastName: string;
}



function TripStatusCardItem({ item }: { item: TripStatusItem }) {
    const [expanded, setExpanded] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);

    const isPast = dayjs().isAfter(dayjs(item.trip.departureTime));

    const departureTime = dayjs(item.trip.departureTime).format("h:mma");
    const arrivalTime = dayjs(item.trip.estimatedArrivalTime).format("h:mma");

    return (
        <>
            <div
                className="w-full bg-white rounded-2xl overflow-hidden border border-gray-200 cursor-pointer"
                onClick={() => setSheetOpen(true)}
            >
                {/* Main Card Row */}
                <div className="flex flex-col md:flex-row md:items-center px-6 py-5 gap-4 md:gap-5">

                    {/* Flight Times & Route */}
                    <div className="flex flex-col gap-0.5 md:w-min">
                        <div className="flex items-center gap-2">
                            <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight whitespace-nowrap">{departureTime}</span>
                            <PlaneDots />
                            <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight relative whitespace-nowrap">
                                {arrivalTime}
                                {/* <sup className="text-xs text-rose-500 font-semibold ml-0.5">+1</sup> */}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.trip.departureCity.title} ({item.trip.departureCity.locality}) – {item.trip.arrivalCity.title} ({item.trip.arrivalCity.locality})</p>
                    </div>

                    {/* Spacer (md+) */}
                    <div className="hidden md:flex flex-1" />

                    {/* Transport mode & Price row (sm: below route, md+: inline) */}
                    <div className="flex items-center md:contents gap-5">

                        {/* Transport mode — sm only: text only */}
                        <div className="flex md:hidden flex-col items-center gap-1">
                            <p className="text-sm font-medium text-neutral-900">Transport:{" "}<span className="capitalize">{item.trip.vehicleType}</span></p>
                        </div>

                        {/* Transport mode — md+ only: icon + label */}
                        <div className="hidden md:flex flex-col items-center gap-1">
                            {item.trip.vehicleType === "bus" ? (
                                <VanIcon weight="duotone" size={24} />
                            ) : (
                                <CarProfileIcon weight="duotone" size={24} />
                            )}
                            <p className="text-sm text-muted-foreground">Transport</p>
                        </div>

                        {/* Spacer (md+) */}
                        <div className="hidden md:flex flex-1" />

                        {/* Price — sm only: no label, smaller */}
                        <div className="flex md:hidden flex-col items-end ml-auto">
                            <p className="text-xl font-medium text-neutral-900">{formatPrice(item.trip.price)}</p>
                        </div>

                        {/* Price — md+ only: with label */}
                        <div className="hidden md:flex flex-col items-end">
                            <p className="text-2xl font-medium text-neutral-900">{formatPrice(item.trip.price)}</p>
                            <p className="text-sm text-muted-foreground">Price</p>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200" />

                {/* Footer */}
                <div className={`flex justify-end px-6 py-1.5 ${isPast ? "bg-red-700 text-white" : ""}`}>
                    {isPast ? (
                        <span className="text-sm font-medium text-white">Expired</span>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                            className="text-sm text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                        >
                            {expanded ? "Hide details" : "Driver details"}
                        </button>
                    )}
                </div>

                {/* Expanded Details */}
                <AnimatePresence initial={false}>
                    {expanded && item.driver && (
                        <motion.div
                            key="driver-details"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                            style={{ overflow: "hidden" }}
                        >
                            <DriverInfo {...item.driver} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <TripDetailsSheet
                trip={item.trip}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />
        </>
    );
}

// ----- Grouped list -----

function groupByDate(items: TripStatusItem[]): Map<string, TripStatusItem[]> {
    const map = new Map<string, TripStatusItem[]>();

    // Sort items: future dates first, then past dates descending
    const sorted = [...items].sort((a, b) => {
        const da = dayjs(a.trip.departureTime);
        const db = dayjs(b.trip.departureTime);
        const now = dayjs();
        const aIsPast = da.isBefore(now);
        const bIsPast = db.isBefore(now);

        if (!aIsPast && !bIsPast) return da.isBefore(db) ? -1 : 1; // upcoming: ascending
        if (aIsPast && bIsPast) return da.isBefore(db) ? 1 : -1;   // past: descending
        return aIsPast ? 1 : -1; // upcoming before past
    });

    for (const item of sorted) {
        const key = dayjs(item.trip.departureTime).format("MMM D, YYYY");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
    }

    return map;
}

// ----- Mock data -----

const mockDriver: DriverInfoProps = {
    firstName: "Adebayo",
    lastName: "Okonkwo",
    phoneNumber: "08012345678",
    country: "Nigeria",
    state: "Lagos",
    profilePictureUrl: "https://images.unsplash.com/photo-1617244147030-8bd6f9e21d1e?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
};

const mockItems: TripStatusItem[] = [
    {
        id: "1",
        bookingRef: "DE-001",
        passengerLastName: "Smith",
        driver: mockDriver,
        trip: {
            departureCity: {
                title: "Kuto Park",
                locality: "Abeokuta South",
                label: "Ojota Motor Park",
            },
            arrivalCity: {
                title: "Olabisi Onabanjo University-Oou Main Campus",
                locality: "Ijebu North",
                label: "Ijebu-Ode Motor Park",
            },
            vehicleType: "bus",
            seatNumber: 14,
            price: 6000,
            departureTime: new Date("2026-02-20T11:50:00"),
            estimatedArrivalTime: new Date("2026-02-20T16:51:00"),
            meetingPoint: "Meet at Fajol hostel",
        },
    },
    {
        id: "2",
        bookingRef: "DE-002",
        passengerLastName: "Jones",
        driver: mockDriver,
        trip: {
            departureCity: {
                title: "Ojota Motor Park",
                locality: "Lagos Mainland",
                label: "Ojota Motor Park",
            },
            arrivalCity: {
                title: "Nnamdi Azikiwe International Airport",
                locality: "Abuja Municipal",
                label: "Abuja Arrival Terminal",
            },
            vehicleType: "bus",
            seatNumber: 8,
            price: 15000,
            departureTime: new Date("2026-03-18T07:00:00"),
            estimatedArrivalTime: new Date("2026-03-18T13:30:00"),
            meetingPoint: "Meet at Ojota Under Bridge",
        },
    },
    {
        id: "3",
        bookingRef: "DE-003",
        passengerLastName: "Brown",
        driver: mockDriver,
        trip: {
            departureCity: {
                title: "Challenge Interchange",
                locality: "Ibadan North",
                label: "Challenge Bus Terminal",
            },
            arrivalCity: {
                title: "New Artisan Market Junction",
                locality: "Osun Central",
                label: "Osogbo Motor Park",
            },
            vehicleType: "car",
            seatNumber: 3,
            price: 4500,
            departureTime: new Date("2026-03-18T09:30:00"),
            estimatedArrivalTime: new Date("2026-03-18T11:45:00"),
            meetingPoint: "Meet at Challenge bus stop, opposite GTBank",
        },
    },
    {
        id: "4",
        bookingRef: "DE-004",
        passengerLastName: "Eze",
        driver: mockDriver,
        trip: {
            departureCity: {
                title: "Mile 1 Motor Park",
                locality: "Port Harcourt City",
                label: "Mile 1 Motor Park",
            },
            arrivalCity: {
                title: "Onitsha Head Bridge",
                locality: "Onitsha North",
                label: "Onitsha Main Market Park",
            },
            vehicleType: "bus",
            seatNumber: 18,
            price: 8500,
            departureTime: new Date("2026-03-19T06:00:00"),
            estimatedArrivalTime: new Date("2026-03-19T10:00:00"),
            meetingPoint: "Meet at Mile 1 Park gate",
        },
    },
    {
        id: "5",
        bookingRef: "DE-005",
        passengerLastName: "Musa",
        driver: mockDriver,
        trip: {
            departureCity: {
                title: "Wuse Zone 4 Junction",
                locality: "Abuja Municipal",
                label: "Abuja Central Park",
            },
            arrivalCity: {
                title: "Kaduna Central Market",
                locality: "Kaduna North",
                label: "Kaduna Motor Park",
            },
            vehicleType: "car",
            seatNumber: 2,
            price: 11000,
            departureTime: new Date("2026-03-20T08:15:00"),
            estimatedArrivalTime: new Date("2026-03-20T11:00:00"),
            meetingPoint: "Meet at Wuse Zone 4 roundabout",
        },
    },
];

// ----- Default export -----

export default function TripStatusCard() {
    const grouped = groupByDate(mockItems);

    return (
        <div className="flex flex-col gap-8 pt-6">
            {Array.from(grouped.entries()).map(([dateLabel, items]) => (
                <div key={dateLabel} className="flex flex-col gap-3">
                    {/* Date header */}
                    <h3 className="text-base font-semibold text-neutral-700">
                        {dateLabel}
                    </h3>

                    {/* Cards under this date */}
                    {items.map((item) => (
                        <TripStatusCardItem key={item.id} item={item} />
                    ))}
                </div>
            ))}
        </div>
    );
}
