"use client"

import { PlaneDots } from "@repo/ui/PlaneDots";
import { formatPrice } from "@repo/ui/lib/utils";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { useQueryClient } from "@repo/api";
import { useState } from "react";
import { TripStatusItem } from "~/lib/type";
import TripDetailsSheet from "./TripDetailsSheet";

dayjs.extend(duration);

const TRANSACTION_FEE = 1000;

const TripStatusCardItem = ({ item }: { item: TripStatusItem }) => {
    const [sheetOpen, setSheetOpen] = useState(false);
    const queryClient = useQueryClient();

    const departure = dayjs(item.trip.departureTime);
    const arrival = dayjs(item.trip.estimatedArrivalTime);
    const hasDeparted = dayjs().isAfter(item.trip.departureTime);

    const departureTime = departure.format("h:mma");
    const arrivalTime = arrival.format("h:mma");

    const tripDuration = dayjs.duration(arrival.diff(departure));

    const totalHours = Math.floor(tripDuration.asHours());
    const minutes = tripDuration.minutes();

    const durationText =
        totalHours > 0 && minutes > 0
            ? `${totalHours}h ${minutes}m`
            : totalHours > 0
                ? `${totalHours}h`
                : `${minutes}m`;

    const openSheet = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.blur();
        queryClient.invalidateQueries({ queryKey: ["userBookings"] });
        setSheetOpen(true);
    };

    const preloadDriverImages = () => {
        const images = [
            "/driver-not-found.webp",
            "/awaiting-driver.webp",
            "/refund-stamp.png",
            "/refund-fail-stamp.png",
        ];

        images.forEach((src) => {
            const img = new Image();
            img.decoding = "async";
            img.src = src;
        });
    };

    return (
        <>
            <div className="relative w-full bg-white rounded-2xl overflow-hidden px-1">
                <div className="flex flex-col lg:flex-row lg:items-start px-2 py-5 gap-6">
                    {/* Left Section */}
                    <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-[auto_1fr_auto] gap-y-1 items-center">
                            <span className="text-lg lg:text-xl font-medium text-neutral-900 whitespace-nowrap">
                                {departureTime}
                            </span>

                            <div className="flex justify-center px-2">
                                <PlaneDots />
                            </div>

                            <span className="text-lg lg:text-xl font-medium text-neutral-900 whitespace-nowrap">
                                {arrivalTime}
                            </span>

                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                                {item.trip.departureCity.title}
                            </span>

                            <span className="text-sm text-muted-foreground text-center whitespace-nowrap">
                                {durationText}
                            </span>

                            <span className="text-sm text-end text-muted-foreground whitespace-nowrap">
                                {item.trip.arrivalCity.title}
                            </span>
                        </div>

                        <button
                            onClick={openSheet}
                            onMouseEnter={preloadDriverImages}
                            className="mt-4 text-sm font-medium text-neutral-800 underline underline-offset-2 hover:text-black cursor-pointer"
                        >
                            Trip details
                        </button>
                    </div>

                    {/* Perforation divider (desktop: vertical, notches top/bottom) */}
                    <div className="hidden lg:flex relative self-stretch shrink-0">
                        <div
                            className="w-px h-full"
                            style={{
                                backgroundImage:
                                    "radial-gradient(circle, #d4d4d8 1.5px, transparent 1.5px)",
                                backgroundSize: "1px 10px",
                                backgroundRepeat: "repeat-y",
                            }}
                        />
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gray-50" />
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 translate-y-1/2 w-7 h-7 rounded-full bg-gray-50" />
                    </div>

                    {/* Perforation divider (mobile: horizontal, notches left/right) */}
                    <div className="lg:hidden relative w-full h-px">
                        <div
                            className="w-full h-px"
                            style={{
                                backgroundImage:
                                    "radial-gradient(circle, #d4d4d8 1.5px, transparent 1.5px)",
                                backgroundSize: "10px 1px",
                                backgroundRepeat: "repeat-x",
                            }}
                        />
                        <div className="absolute -left-2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-neutral-50" />
                        <div className="absolute -right-2 top-1/2 translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-neutral-50" />
                    </div>

                    {/* Right Section */}
                    <div className="flex gap-3 shrink-0">
                        <div className="w-[160px] rounded-xl border px-4 py-2.5 transition border-neutral-200 bg-white hover:border-black">
                            <p className="text-sm text-neutral-500">
                                {item.trip.vehicleType === "bus" ? "Bus" : "Car"}
                                {hasDeparted && (
                                    <>
                                        <span> &ndash; </span>
                                        <span className="text-red-600 font-medium">Expired</span>
                                    </>
                                )}
                                {item.paymentStatus === "refund_pending" && (
                                    <>
                                        <span> &ndash; </span>
                                        <span className="text-amber-600 font-medium">Refunding</span>
                                    </>
                                )}
                            </p>

                            <p className="mt-2 text-xl font-medium text-neutral-900">
                                {formatPrice(
                                    (item.trip.vehicleType === "bus"
                                        ? item.trip.priceBus
                                        : item.trip.priceCar) + TRANSACTION_FEE
                                )}
                            </p>
                        </div>
                    </div>
                </div>
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
                driverStatus={item.driverStatus}
                showDriverDetails={true}
                driver={item.driver}
                displayMessage={item.displayMessage}
                paymentStatus={item.paymentStatus}
            />
        </>
    );
}

export default TripStatusCardItem;