"use client";

import type { TRoute } from "@repo/types/routeSchema";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@repo/ui/components/sheet";
import { Button } from "@repo/ui/components/button";
import { Separator } from "@repo/ui/components/separator";
import { CarProfileIcon, InfoIcon, MapPinAreaIcon } from "@phosphor-icons/react";
import { formatPrice } from "@repo/ui/lib/utils";
import dayjs from "dayjs";

const TRANSACTION_FEE_RATE = 0.10;

interface TripDetailsSheetProps {
    trip: TRoute;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function getDuration(departure: Date, arrival: Date) {
    const diffMs = arrival.getTime() - departure.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

export default function TripDetailsSheet({
    trip,
    open,
    onOpenChange,
}: TripDetailsSheetProps) {
    const duration = getDuration(trip.departureTime, trip.estimatedArrivalTime);
    const transactionFee = trip.price * TRANSACTION_FEE_RATE;
    const departureTime = dayjs(trip.departureTime).format("HH:mm");
    const arrivalTime = dayjs(trip.estimatedArrivalTime).format("HH:mm");
    const departureDate = dayjs(trip.departureTime).format("ddd, D MMM YYYY");

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[480px] p-0 flex flex-col overflow-hidden">
                {/* Header */}
                <SheetHeader className="px-6 pt-6 pb-5 border-b border-gray-100">
                    <SheetTitle className="text-center text-base font-normal tracking-wide text-neutral-800">
                        Trip details
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                        Trip from {trip.departureCity.title} to {trip.arrivalCity.title}
                    </SheetDescription>
                </SheetHeader>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto">
                    {/* Route title */}
                    <div className="px-6 pt-6 pb-5 space-y-1">
                        <h2 className="text-xl font-bold text-neutral-900">
                            {trip.departureCity.title} to {trip.arrivalCity.title}
                        </h2>
                        <p className="text-sm text-neutral-500">{departureDate}</p>
                    </div>

                    {/* Timeline */}
                    <div className="px-6 pb-2">
                        <div className="flex gap-4">
                            {/* Left: times + duration aligned with Car icon */}
                            <div className="flex flex-col items-end text-sm select-none shrink-0 w-14">
                                {/* Departure time — aligns with top dot */}
                                <span className="font-medium text-neutral-700 h-3.5 flex items-center mb-6">
                                    {departureTime}am
                                </span>
                                {/* Segment 1 spacer — now starts at same y as right-col seg1 */}
                                <div className="flex-1 min-h-[120px]" />
                                {/* Duration — aligns with Car icon in segment 2 */}
                                <div className="w-full flex-1 relative min-h-[120px]">
                                    <span className="absolute inset-0 flex items-center text-xs text-neutral-700">
                                        {duration}
                                    </span>
                                </div>
                                {/* Arrival time — aligns with bottom dot */}
                                <span className="font-medium text-neutral-700 h-3.5 flex items-center mt-6">
                                    {arrivalTime}pm
                                </span>
                            </div>

                            {/* Center: continuous absolute line + 4 landmarks */}
                            <div className="relative flex flex-col items-center shrink-0 w-5">
                                {/* Full-height line */}
                                <div className="absolute left-1/2 top-[7px] bottom-[7px] w-px bg-neutral-300 -translate-x-1/2" />
                                {/* Top dot — departure; mb-6 offsets to match departure subtitle height in right col */}
                                <div className="relative z-10 w-3.5 h-3.5 rounded-full border-2 border-neutral-400 bg-white shrink-0 mb-6" />
                                {/* Segment 1: MapPin centered — now aligned with meeting point text */}
                                <div className="relative z-10 flex-1 flex items-center justify-center min-h-[120px]">
                                    <div className="bg-white py-1">
                                        <MapPinAreaIcon
                                            weight="duotone"
                                            size={20}
                                            className="text-neutral-500"
                                        />
                                    </div>
                                </div>
                                {/* Segment 2: Car icon centered — now aligned with vehicle info text */}
                                <div className="relative z-10 flex-1 flex items-center justify-center min-h-[120px]">
                                    <div className="bg-white py-1">
                                        <CarProfileIcon
                                            weight="duotone"
                                            size={20}
                                            className="text-neutral-500"
                                        />
                                    </div>
                                </div>
                                {/* Bottom dot — arrival; mt-6 offsets to match arrival subtitle height in right col */}
                                <div className="relative z-10 w-3.5 h-3.5 rounded-full border-2 border-neutral-400 bg-white shrink-0 mt-6" />
                            </div>

                            {/* Right: city info matching center segments */}
                            <div className="flex flex-col flex-1 text-sm">
                                {/* Departure city — h-3.5, aligns with top dot */}
                                <div>
                                    <p className="font-bold text-neutral-900 h-3.5 flex items-center">
                                        {trip.departureCity.title}
                                    </p>
                                    <p className="text-muted-foreground text-sm leading-5 mt-1">
                                        {trip.departureCity.label}
                                    </p>
                                </div>

                                {/* Segment 1: meeting point centered */}
                                <div className="flex-1 relative min-h-[120px]">
                                    <p className="absolute inset-0 flex items-center text-sm text-neutral-900">
                                        {trip.meetingPoint} to board vehicle
                                    </p>
                                </div>
                                {/* Segment 2: vehicle info centered */}
                                <div className="flex-1 relative min-h-[120px]">
                                    <p className="absolute inset-0 flex items-center gap-2 text-sm text-neutral-900 capitalize font-medium">
                                        {trip.vehicleType}
                                        <span className="font-normal text-muted-foreground">
                                            {" "}· {trip.seatNumber} seats
                                        </span>
                                    </p>
                                </div>
                                {/* Arrival city — h-3.5, aligns with bottom dot */}
                                <div>
                                    <p className="font-bold text-neutral-900 h-3.5 flex items-center">
                                        {trip.arrivalCity.title}
                                    </p>
                                    <p className="text-muted-foreground text-sm leading-5 mt-1">
                                        {trip.arrivalCity.label}
                                    </p>
                                </div>

                            </div>
                        </div>
                    </div>


                    {/* Price breakdown */}
                    <div className="px-6 py-6 space-y-4">
                        <Separator />
                        <div className="space-y-2 text-sm">
                            <div className="flex">
                                <span className="flex-1 text-neutral-900">Seat Availability</span>
                                <span className="text-neutral-700">2 left</span>
                            </div>
                            <div className="flex">
                                <span className="flex-1 text-neutral-900">Transaction fee</span>
                                <span className="text-neutral-700">{formatPrice(transactionFee)}</span>
                            </div>
                            <div className="flex font-semibold">
                                <span className="flex-1 text-neutral-900">Total</span>
                                <span className="text-neutral-900 text-base">
                                    {formatPrice(trip.price + transactionFee)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notification above Book button */}
                <div className="px-6 pb-3">
                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <InfoIcon
                            weight="fill"
                            size={16}
                            className="text-amber-600 shrink-0 mt-0.5"
                        />
                        <p className="text-xs text-amber-800 leading-relaxed">
                            If you intend to travel with luggage, please contact the driver in advance to confirm availability.
                        </p>
                    </div>
                </div>

                {/* Footer: Book button */}
                <div className="px-6 pb-6 pt-2 border-t border-gray-100">
                    <Button className="w-full h-12 text-base font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 cursor-pointer">
                        Book Trip
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
