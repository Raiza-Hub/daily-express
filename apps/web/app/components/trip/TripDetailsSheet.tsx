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
import { formatPrice, getDuration } from "@repo/ui/lib/utils";
import dayjs from "dayjs";

const TRANSACTION_FEE_RATE = 0.05;

interface TripDetailsSheetProps {
    trip: TRoute;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}


export default function TripDetailsSheet({
    trip,
    open,
    onOpenChange,
}: TripDetailsSheetProps) {
    const duration = getDuration(trip.departureTime, trip.estimatedArrivalTime);
    const transactionFee = trip.price * TRANSACTION_FEE_RATE;
    const departureTime = dayjs(trip.departureTime).format("h:mma");
    const arrivalTime = dayjs(trip.estimatedArrivalTime).format("h:mma");
    const departureDate = dayjs(trip.departureTime).format("ddd, D MMM YYYY");

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full md:max-w-[480px] p-0 flex flex-col overflow-hidden">
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
                    <div className="px-6  pb-5 space-y-1">
                        <h2 className="text-xl font-bold text-neutral-900">
                            {trip.departureCity.title} to {trip.arrivalCity.title}
                        </h2>
                        <p className="text-sm text-neutral-500">{departureDate}</p>
                    </div>

                    {/* Timeline — row-based: each section is self-contained so the
                         line grows with its row when text wraps on small screens */}
                    <div className="px-6 pb-2">

                        {/* Row: Departure */}
                        <div className="flex gap-4">
                            {/* time */}
                            <div className="shrink-0 w-14 flex justify-end items-start pt-px">
                                <span className="text-sm font-medium text-neutral-700 select-none">{departureTime}</span>
                            </div>
                            {/* line + dot */}
                            <div className="relative shrink-0 w-5 flex flex-col items-center">
                                <div className="relative z-10 w-3.5 h-3.5 rounded-full border-2 border-neutral-400 bg-white shrink-0 mt-px" />
                                {/* line going down to next row */}
                                <div className="flex-1 w-px bg-neutral-300 mt-1" />
                            </div>
                            {/* content */}
                            <div className="flex-1 flex flex-col pb-5">
                                <p className="font-bold text-sm text-neutral-900 leading-none">{trip.departureCity.title}</p>
                                <p className="text-muted-foreground text-sm leading-5 mt-1">{trip.departureCity.label}</p>
                            </div>
                        </div>

                        {/* Row: Meeting Point */}
                        <div className="flex gap-4">
                            {/* time (empty) */}
                            <div className="shrink-0 w-14" />
                            {/* line + icon */}
                            <div className="relative shrink-0 w-5 flex flex-col items-center min-h-[90px]">
                                {/* line from top */}
                                <div className="w-px bg-neutral-300 flex-1" />
                                <div className="relative z-10 bg-white py-1 shrink-0">
                                    <MapPinAreaIcon weight="duotone" size={20} className="text-neutral-500" />
                                </div>
                                {/* line to bottom */}
                                <div className="w-px bg-neutral-300 flex-1" />
                            </div>
                            {/* content */}
                            <div className="flex-1 flex items-center py-4">
                                <p className="text-sm text-neutral-900">{trip.meetingPoint} to board vehicle</p>
                            </div>
                        </div>

                        {/* Row: Vehicle Type */}
                        <div className="flex gap-4">
                            {/* duration */}
                            <div className="shrink-0 w-14 flex justify-start items-center">
                                <span className="text-sm text-neutral-700 select-none">{duration}</span>
                            </div>
                            {/* line + icon */}
                            <div className="relative shrink-0 w-5 flex flex-col items-center min-h-[90px]">
                                {/* line from top */}
                                <div className="w-px bg-neutral-300 flex-1" />
                                <div className="relative z-10 bg-white py-1 shrink-0">
                                    <CarProfileIcon weight="duotone" size={20} className="text-neutral-500" />
                                </div>
                                {/* line to bottom */}
                                <div className="w-px bg-neutral-300 flex-1" />
                            </div>
                            {/* content */}
                            <div className="flex-1 flex items-center py-4">
                                <p className="flex items-center gap-2 text-sm text-neutral-900 capitalize font-medium">
                                    {trip.vehicleType}
                                    <span className="font-normal text-muted-foreground">{" "}· {trip.seatNumber} seats</span>
                                </p>
                            </div>
                        </div>

                        {/* Row: Arrival */}
                        <div className="flex gap-4">
                            {/* time — items-end to align with dot */}
                            <div className="shrink-0 w-14 flex justify-end items-end pb-px">
                                <span className="text-sm font-medium text-neutral-700 select-none">{arrivalTime}</span>
                            </div>
                            {/* line then dot */}
                            <div className="relative shrink-0 w-5 flex flex-col items-center min-h-[60px]">
                                <div className="w-px bg-neutral-300 flex-1" />
                                <div className="relative z-10 w-3.5 h-3.5 rounded-full border-2 border-neutral-400 bg-white shrink-0" />
                            </div>
                            {/* content — justify-end so city text sits at bottom next to dot */}
                            <div className="flex-1 flex flex-col justify-end">
                                <p className="font-bold text-sm text-neutral-900 leading-none">{trip.arrivalCity.title}</p>
                                <p className="text-muted-foreground text-sm leading-5 mt-1">{trip.arrivalCity.label}</p>
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
