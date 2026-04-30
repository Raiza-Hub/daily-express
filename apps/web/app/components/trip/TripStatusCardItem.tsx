"use client"

import { CarProfileIcon, VanIcon } from "@phosphor-icons/react";
import { PlaneDots } from "@repo/ui/PlaneDots";
import dayjs from "dayjs";
import { AnimatePresence, domAnimation, LazyMotion, m } from "framer-motion";
import { useState } from "react";
import { TripStatusItem } from "~/lib/type";
import { DriverInfo } from "../DriverInfo";
import TripDetailsSheet from "./TripDetailsSheet";
import { formatPrice } from "@repo/ui/lib/utils";

const TripStatusCardItem = ({ item }: { item: TripStatusItem }) => {
    const [expanded, setExpanded] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);

    const isPast = dayjs().isAfter(item.trip.departureTime);

    const departureTime = dayjs(item.trip.departureTime).format("h:mma");
    const arrivalTime = dayjs(item.trip.estimatedArrivalTime).format("h:mma");
    const openSheet = () => setSheetOpen(true);

    return (
        <>
            <div
                className="w-full bg-white rounded-2xl overflow-hidden border border-gray-200 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={openSheet}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openSheet();
                    }
                }}
            >
                <div className="flex flex-col md:flex-row md:items-center px-6 py-5 gap-4 md:gap-5">

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

                    <div className="hidden md:flex flex-1" />

                    <div className="flex items-center md:contents gap-5">

                        <div className="flex md:hidden flex-col items-center gap-1">
                            <p className="text-sm font-medium text-neutral-900">Transport:{" "}<span className="capitalize">{item.trip.vehicleType}</span></p>
                        </div>

                        <div className="hidden md:flex flex-col items-center gap-1">
                            {item.trip.vehicleType === "bus" ? (
                                <VanIcon weight="duotone" size={24} />
                            ) : (
                                <CarProfileIcon weight="duotone" size={24} />
                            )}
                            <p className="text-sm text-muted-foreground">Transport</p>
                        </div>

                        <div className="hidden md:flex flex-1" />

                        <div className="flex md:hidden flex-col items-end ml-auto">
                            <p className="text-xl font-medium text-neutral-900">{formatPrice(item.trip.price)}</p>
                        </div>

                        <div className="hidden md:flex flex-col items-end">
                            <p className="text-2xl font-medium text-neutral-900">{formatPrice(item.trip.price)}</p>
                            <p className="text-sm text-muted-foreground">Price</p>
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-200" />

                <div className={`flex justify-end px-6 py-1.5 ${isPast ? "bg-red-700 text-white" : ""}`}>
                    {isPast ? (
                        <span className="text-sm font-medium text-white">Expired</span>
                    ) : (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                            className="text-sm text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                        >
                            {expanded ? "Hide details" : "Driver details"}
                        </button>
                    )}
                </div>

                <AnimatePresence initial={false}>
                    {expanded && item.driver && (
                        <LazyMotion features={domAnimation}>
                            <m.div
                                key="driver-details"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                style={{ overflow: "hidden" }}
                            >
                                <DriverInfo {...item.driver} />
                            </m.div>
                        </LazyMotion>
                    )}
                </AnimatePresence>
            </div>

            <TripDetailsSheet
                trip={item.trip}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                bookingContext={{
                    routeId: item.routeId,
                    tripDate: item.tripDate,
                    remainingSeats: item.remainingSeats,
                }}
                allowBooking={false}
            />
        </>
    );
}

export default TripStatusCardItem;
