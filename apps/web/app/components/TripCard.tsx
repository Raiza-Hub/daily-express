"use client";

import { CarIcon, CarProfileIcon, MapPinAreaIcon, PhoneCallIcon, PhoneIcon } from "@phosphor-icons/react";
import { Avatar, AvatarImage } from "@repo/ui/components/avatar";
import { useState } from "react";
import TripDetailsSheet from "./TripDetailsSheet";
import type { TRoute } from "@repo/types/routeSchema";

const PlaneDots = () => (
    <div className="flex items-center gap-1 flex-1 mx-3 min-w-60">
        <div className="w-2 h-2 rounded-full bg-neutral-500 border-2 border-neutral-500" />
        <div className="flex-1 border-t-2 border-dotted border-neutral-400" />
        <div className="w-2 h-2 rounded-full bg-neutral-500 border-2 border-neutral-500" />
    </div>
);



const mockDriver = {
    firstName: "Adebayo",
    lastName: "Okonkwo",
    phoneNumber: "08012345678",
    country: "Nigeria",
    state: "Lagos",
    profilePictureUrl: "https://images.unsplash.com/photo-1617244147030-8bd6f9e21d1e?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
};

interface Driver {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    country: string;
    state: string;
    profilePictureUrl: string;
}

const DriverInfo = ({ driver }: { driver: Driver }) => {
    const fullName = `${driver.firstName} ${driver.lastName}`;
    const initials = `${driver.firstName[0]}${driver.lastName[0]}`;

    return (
        <div className="border-t border-gray-100 px-6 py-5 bg-gray-50">
            <p className="text-base font-semibold mb-4">Driver Details</p>
            <div className="flex items-center gap-5">
                {/* Avatar */}
                <div className="relative shrink-0">
                    <Avatar className="h-16 w-16">
                        <AvatarImage className="object-cover" src={driver.profilePictureUrl || ""} alt={`${driver.firstName} ${driver.lastName}`} />
                    </Avatar>
                </div>

                {/* Info */}
                <div className="flex flex-col gap-2 flex-1">
                    <p className="text-base font-medium leading-none">{fullName}</p>

                    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                        {/* Phone */}
                        <div className="flex items-center gap-1.5">
                            <PhoneCallIcon />
                            <span className="text-sm text-neutral-600">{driver.phoneNumber}</span>
                        </div>

                        {/* Location */}
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


const mockTrip: TRoute = {
    departureCity: "Lagos",
    arrivalCity: "Allentown",
    vehicleType: "bus",
    seatNumber: 14,
    price: 6000,
    departureTime: new Date("2026-02-20T11:50:00"),
    estimatedArrivalTime: new Date("2026-02-20T16:51:00"),
    meetingPoint: "Meet at Fajol hostel",
};

export default function TripCard() {
    const [expanded, setExpanded] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);

    return (
        <div className="flex flex-col gap-4 pt-6">
            <div className="flex flex-col gap-1">
                <h3 className="text-lg text-neutral-900 font-semibold">11 results</h3>
                <p className="text-sm text-muted-foreground">Fares displayed are for all passengers.</p>
            </div>

            <div
                className="w-full bg-white rounded-2xl overflow-hidden border border-gray-200 cursor-pointer"
                onClick={() => setSheetOpen(true)}
            >
                {/* Main Card Row */}
                <div className="flex items-center px-6 py-5 gap-5">

                    {/* Flight Times & Route */}
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-medium text-neutral-900 tracking-tight">11:50am</span>
                            <PlaneDots />
                            <span className="text-xl font-medium text-neutral-900 tracking-tight relative">
                                4:51pm
                                {/* <sup className="text-xs text-rose-500 font-semibold ml-0.5">+1</sup> */}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">Lagos (LOS) – Allentown (ABE)</p>
                        <p className="text-sm text-muted-foreground">United operated by United and Gojet Airlines DBA United Express</p>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Duration & Stops */}
                    <div className="flex flex-col items-center gap-1">
                        <CarProfileIcon
                            weight="duotone"
                            className=""
                            size={24}
                        />
                        <p className="text-sm text-muted-foreground">Transport mode</p>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Price */}
                    <div className="flex flex-col  items-end">
                        <p className="text-2xl font-medium text-neutral-900">₦4,500</p>
                        <p className="text-sm text-muted-foreground">Price</p>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200" />

                {/* Footer */}
                <div className="flex justify-end px-6 py-3">
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                        className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                        {expanded ? "Hide details" : "Driver details"}
                    </button>
                </div>

                {/* Expanded Details */}
                {expanded && <DriverInfo driver={mockDriver} />}
            </div>

            <p className="text-sm text-muted-foreground">
                Fares may change depending on the selected trips and dates, and are not final until payment is completed and the booking is confirmed. Prices are per person and do not include luggage fees. Bookings are non-refundable once trips are confirmed.
            </p>

            <TripDetailsSheet
                trip={mockTrip}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />
        </div>
    );
}