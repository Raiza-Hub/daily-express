"use client";

import { CarProfileIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { TRoute } from "@repo/types/routeSchema";
import TripDetailsSheet from "./TripDetailsSheet";
import { PlaneDots } from "@repo/ui/PlaneDots";
import { DriverInfo } from "~/components/DriverInfo";
import type { DriverInfoProps } from "~/components/DriverInfo";




const mockDriver: DriverInfoProps = {
    firstName: "Adebayo",
    lastName: "Okonkwo",
    phoneNumber: "08012345678",
    country: "Nigeria",
    state: "Lagos",
    profilePictureUrl: "https://images.unsplash.com/photo-1617244147030-8bd6f9e21d1e?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
};


const mockTrip: TRoute = {
    departureCity: {
        title: "Kuto Park",
        locality: "Abeokuta South",
        label: "Ojota Motor Park"
    },
    arrivalCity: {
        title: "Olabisi Onabanjo University-Oou Main Campus",
        locality: "Ijebu North",
        label: "Lehigh Valley International Airport"
    },
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
                <h3 className="text-xl text-neutral-900 font-semibold">11 results</h3>
                <p className="text-base text-muted-foreground">Fares displayed are for all passengers.</p>
            </div>

            <div
                className="w-full bg-white rounded-2xl overflow-hidden border border-gray-200 cursor-pointer"
                onClick={() => setSheetOpen(true)}
            >
                {/* Main Card Row */}
                <div className="flex flex-col md:flex-row md:items-center px-6 py-5 gap-4 md:gap-5">

                    {/* Flight Times & Route */}
                    <div className="flex flex-col gap-0.5 md:w-min">
                        <div className="flex items-center gap-2">
                            <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight whitespace-nowrap">11:50am</span>
                            <PlaneDots />
                            <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight relative whitespace-nowrap">
                                4:51pm
                                {/* <sup className="text-xs text-rose-500 font-semibold ml-0.5">+1</sup> */}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{mockTrip.departureCity.title} ({mockTrip.departureCity.locality}) – {mockTrip.arrivalCity.title} ({mockTrip.arrivalCity.locality})</p>
                    </div>

                    {/* Spacer (md+) */}
                    <div className="hidden md:flex flex-1" />

                    {/* Transport mode & Price row (sm: below route, md+: inline) */}
                    <div className="flex items-center md:contents gap-5">

                        {/* Transport mode — sm only: text only */}
                        <div className="flex md:hidden flex-col items-center gap-1">
                            <p className="text-sm font-medium text-neutral-900">Transport:{" "}<span className="capitalize">{mockTrip.vehicleType}</span></p>
                        </div>

                        {/* Transport mode — md+ only: icon + label */}
                        <div className="hidden md:flex flex-col items-center gap-1">
                            <CarProfileIcon weight="duotone" size={24} />
                            <p className="text-sm text-muted-foreground">Transport</p>
                        </div>

                        {/* Spacer (md+) */}
                        <div className="hidden md:flex flex-1" />

                        {/* Price — sm only: no label, smaller */}
                        <div className="flex md:hidden flex-col items-end ml-auto">
                            <p className="text-xl font-medium text-neutral-900">₦4,500</p>
                        </div>

                        {/* Price — md+ only: with label */}
                        <div className="hidden md:flex flex-col items-end">
                            <p className="text-2xl font-medium text-neutral-900">₦4,500</p>
                            <p className="text-sm text-muted-foreground">Price</p>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200" />

                {/* Footer */}
                <div className="flex justify-end px-6 py-1.5">
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                        className="text-sm text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                    >
                        {expanded ? "Hide details" : "Driver details"}
                    </button>
                </div>

                {/* Expanded Details */}
                <AnimatePresence initial={false}>
                    {expanded && (
                        <motion.div
                            key="driver-details"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                            style={{ overflow: "hidden" }}
                        >
                            <DriverInfo {...mockDriver} />
                        </motion.div>
                    )}
                </AnimatePresence>
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