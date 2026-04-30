"use client";

import { CarProfileIcon } from "@phosphor-icons/react";
import { SearchTrip } from "~/lib/type";
import TripDetailsSheet from "./TripDetailsSheet";
import { PlaneDots } from "@repo/ui/PlaneDots";
import { DriverInfo } from "~/components/DriverInfo";
import { formatPrice } from "@repo/ui/lib/utils";
import { AnimatePresence, domAnimation, LazyMotion, m } from "framer-motion";
import { useState } from "react";
import dayjs from "dayjs";


const TripCardItem = ({
    item,
    bookingDate,
}: {
    item: SearchTrip;
    bookingDate: string;
}) => {
    const [expanded, setExpanded] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const departureTime = dayjs(item.route.departureTime).format("h:mma");
    const arrivalTime = dayjs(item.route.estimatedArrivalTime).format("h:mma");
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
                            <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight whitespace-nowrap">
                                {departureTime}
                            </span>
                            <PlaneDots />
                            <span className="text-lg lg:text-xl font-medium text-neutral-900 tracking-tight relative whitespace-nowrap">
                                {arrivalTime}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {item.route.departureCity.title} (
                            {item.route.departureCity.locality}) –{" "}
                            {item.route.arrivalCity.title} ({item.route.arrivalCity.locality})
                        </p>
                    </div>

                    <div className="hidden md:flex flex-1" />

                    <div className="flex items-center md:contents gap-5">
                        <div className="flex md:hidden flex-col items-center gap-1">
                            <p className="text-sm font-medium text-neutral-900">
                                Transport:{" "}
                                <span className="capitalize">{item.route.vehicleType}</span>
                            </p>
                        </div>

                        <div className="hidden md:flex flex-col items-center gap-1">
                            <CarProfileIcon weight="duotone" size={24} />
                            <p className="text-sm text-muted-foreground">Transport</p>
                        </div>

                        <div className="hidden md:flex flex-1" />

                        <div className="flex md:hidden flex-col items-end ml-auto">
                            <p className="text-xl font-medium text-neutral-900">
                                {formatPrice(item.route.price)}
                            </p>
                        </div>

                        <div className="hidden md:flex flex-col items-end">
                            <p className="text-2xl font-medium text-neutral-900">
                                {formatPrice(item.route.price)}
                            </p>
                            <p className="text-sm text-muted-foreground">Price</p>
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-200" />

                <div className="flex justify-end px-6 py-1.5">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(!expanded);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                    >
                        {expanded ? "Hide details" : "Driver details"}
                    </button>
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
                                <DriverInfo
                                    firstName={item.driver.firstName}
                                    lastName={item.driver.lastName}
                                    phoneNumber={item.driver.phone}
                                    country={item.driver.country}
                                    state={item.driver.state}
                                    profilePictureUrl={item.driver.profile_pic ?? ""}
                                />
                            </m.div>
                        </LazyMotion>
                    )}
                </AnimatePresence>
            </div>

            <TripDetailsSheet
                trip={item.route}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                bookingContext={{
                    routeId: item.routeId,
                    tripDate: bookingDate,
                    remainingSeats: item.remainingSeats,
                }}
            />
        </>
    );
}

export default TripCardItem;
