"use client";

import {
    CarProfileIcon,
    MapPinAreaIcon,
    PhoneCallIcon,
    VanIcon,
} from "@phosphor-icons/react";
import { Avatar, AvatarImage } from "@repo/ui/components/avatar";
import { useState } from "react";
import TripDetailsSheet from "./TripDetailsSheet";
import type { TRoute } from "@repo/types/routeSchema";
import dayjs from "dayjs";
import { PlaneDots } from "@repo/ui/PlaneDots";

// ----- Types -----

interface Driver {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    country: string;
    state: string;
    profilePictureUrl: string;
}

export interface TripStatusItem {
    id: string;
    trip: TRoute;
    driver?: Driver;
    bookingRef: string;
    passengerLastName: string;
}

// ----- Sub-components -----

const DriverInfo = ({ driver }: { driver: Driver }) => {
    const fullName = `${driver.firstName} ${driver.lastName}`;

    return (
        <div className="border-t border-gray-100 px-6 py-5 bg-gray-50">
            <p className="text-base font-semibold mb-4">Driver Details</p>
            <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                    <Avatar className="h-16 w-16">
                        <AvatarImage
                            className="object-cover"
                            src={driver.profilePictureUrl || ""}
                            alt={fullName}
                        />
                    </Avatar>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                    <p className="text-base font-medium leading-none">{fullName}</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                        <div className="flex items-center gap-1.5">
                            <PhoneCallIcon />
                            <span className="text-sm text-neutral-600">{driver.phoneNumber}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <MapPinAreaIcon />
                            <span className="text-sm text-neutral-600">
                                {driver.state}, {driver.country}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ExpiredDriverSection = () => (
    <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
        <p className="text-sm text-neutral-400 italic">
            Driver details are no longer available — this trip has passed.
        </p>
    </div>
);

// ----- Single card -----

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
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight">{departureTime}</span>
                            <PlaneDots />
                            <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight relative">
                                {arrivalTime}
                                {/* <sup className="text-xs text-rose-500 font-semibold ml-0.5">+1</sup> */}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.trip.departureCity.title} ({item.trip.departureCity.locality}) – {item.trip.arrivalCity.title} ({item.trip.arrivalCity.locality})</p>
                        <p className="text-sm text-muted-foreground">United operated by United and Gojet Airlines DBA United Express</p>
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
                            <p className="text-xl font-medium text-neutral-900">₦{item.trip.price.toLocaleString()}</p>
                        </div>

                        {/* Price — md+ only: with label */}
                        <div className="hidden md:flex flex-col items-end">
                            <p className="text-2xl font-medium text-neutral-900">₦{item.trip.price.toLocaleString()}</p>
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
                            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            {expanded ? "Hide details" : "Driver details"}
                        </button>
                    )}
                </div>

                {/* Expanded Details */}
                {expanded && item.driver && <DriverInfo driver={item.driver} />}
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

const mockDriver: Driver = {
    firstName: "Adebayo",
    lastName: "Okonkwo",
    phoneNumber: "08012345678",
    country: "Nigeria",
    state: "Lagos",
    profilePictureUrl:
        "https://images.unsplash.com/photo-1617244147030-8bd6f9e21d1e?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
};

const mockItems: TripStatusItem[] = [
    {
        id: "1",
        bookingRef: "DE-Lagos (LOS) – Allentown (ABE)",
        passengerLastName: "Smith",
        driver: mockDriver,
        trip: {
            departureCity: { title: "Lagos", locality: "LOS", label: "Ojota Motor Park" },
            arrivalCity: { title: "Abuja", locality: "ABV", label: "Nnamdi Azikiwe International Airport" },
            vehicleType: "bus",
            seatNumber: 5,
            price: 6000,
            departureTime: new Date("2026-02-19T09:00:00"),
            estimatedArrivalTime: new Date("2026-02-19T13:00:00"),
            meetingPoint: "Meet at Fajol hostel",
        },
    },
    {
        id: "2",
        bookingRef: "DE-002",
        passengerLastName: "Jones",
        driver: mockDriver,
        trip: {
            departureCity: { title: "Lagos", locality: "LOS", label: "Ojota Motor Park" },
            arrivalCity: { title: "Ibadan", locality: "IBA", label: "Ibadan Airport" },
            vehicleType: "car",
            seatNumber: 2,
            price: 3500,
            departureTime: new Date("2026-02-14T08:00:00"),
            estimatedArrivalTime: new Date("2026-02-14T10:30:00"),
            meetingPoint: "Meet at Fajol hostel",
        },
    },
    {
        id: "3",
        bookingRef: "DE-003",
        passengerLastName: "Brown",
        driver: mockDriver,
        trip: {
            departureCity: { title: "Abuja", locality: "ABV", label: "Nnamdi Azikiwe International Airport" },
            arrivalCity: { title: "Lagos", locality: "LOS", label: "Ojota Motor Park" },
            vehicleType: "luxury car",
            seatNumber: 1,
            price: 12000,
            departureTime: new Date("2026-03-05T11:00:00"),
            estimatedArrivalTime: new Date("2026-03-05T16:00:00"),
            meetingPoint: "Meet at Fajol hostel",
        },
    },
    {
        id: "4",
        bookingRef: "DE-004",
        passengerLastName: "Taylor",
        driver: mockDriver,
        trip: {
            departureCity: { title: "Lagos", locality: "LOS", label: "Ojota Motor Park" },
            arrivalCity: { title: "Port Harcourt", locality: "PHC", label: "Port Harcourt International Airport" },
            vehicleType: "bus",
            seatNumber: 9,
            price: 8500,
            departureTime: new Date("2026-03-05T14:30:00"),
            estimatedArrivalTime: new Date("2026-03-05T20:00:00"),
            meetingPoint: "Meet at Fajol hostel",
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
