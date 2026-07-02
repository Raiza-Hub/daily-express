"use client";

import { SearchTrip } from "~/lib/type";
import TripDetailsSheet from "./TripDetailsSheet";
import { PlaneDots } from "@repo/ui/PlaneDots";
import { formatPrice } from "@repo/ui/lib/utils";
import { toast } from "@repo/ui/components/sonner";
import { useState } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { useCreateTripCheckout, isApiError } from "@repo/api";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { posthogEvents } from "~/lib/posthog-events";
import { Spinner } from "@phosphor-icons/react";

dayjs.extend(duration);

const TRANSACTION_FEE = 1000;

const TripCardItem = ({
    item,
    bookingDate,
}: {
    item: SearchTrip;
    bookingDate: string;
}) => {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [bookingVehicleType, setBookingVehicleType] = useState<"car" | "bus" | null>(null);

    const departure = dayjs(item.departureTime);
    const arrival = dayjs(item.estimatedArrivalTime);

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

    const hasDeparted = dayjs().isAfter(item.departureTime);

    const router = useRouter();
    const posthog = usePostHog();

    const { mutateAsync: createTripCheckout, isPending: isCreatingCheckout } =
        useCreateTripCheckout();

    const handleBook = async (vehicleType: "car" | "bus") => {
        if (isCreatingCheckout || hasDeparted) return;

        setBookingVehicleType(vehicleType);

        posthog.capture(posthogEvents.trip_book_initiated, {
            routeId: item.routeId,
            tripDate: bookingDate,
        });

        try {
            const checkout = await createTripCheckout({
                routeId: item.routeId,
                tripDate: bookingDate,
                vehicleType,
                channels: ["bank_transfer"],
                productName: `${item.pickupLocationTitle} to ${item.dropoffLocationTitle}`,
                productDescription: `Trip booking for ${dayjs(bookingDate).format("ddd, D MMM YYYY")}`,
                // metadata: {
                //     routeId: item.routeId,
                //     tripDate: bookingDate,
                // },
            });

            if (!checkout.paymentReference || !checkout.checkoutUrl) {
                throw new Error("Payment initialization failed");
            }

            posthog.capture(posthogEvents.payment_initialization_succeeded, {
                checkoutUrl: checkout.checkoutUrl,
            });

            setBookingVehicleType(null);
            window.location.assign(checkout.checkoutUrl);
        } catch (error) {
            setBookingVehicleType(null);
            if (isApiError(error) && error.statusCode === 401) {
                router.push("/sign-in");
                return;
            }
            const msg = error instanceof Error ? error.message : "Unable to start payment";
            toast.error(msg);
        }
    };

    const openSheet = () => setSheetOpen(true);

    const tripForSheet = {
        departureCity: {
            title: item.pickupLocationTitle,
            locality: item.pickupLocationLocality,
            label: item.pickupLocationLabel,
        },
        arrivalCity: {
            title: item.dropoffLocationTitle,
            locality: item.dropoffLocationLocality,
            label: item.dropoffLocationLabel,
        },
        vehicleType: "car" as const,
        seatNumber: 0,
        priceCar: item.priceCar,
        priceBus: item.priceBus,
        departureTime: item.departureTime,
        estimatedArrivalTime: item.estimatedArrivalTime,
        meetingPoint: item.meetingPoint,
    };

    return (
        <>
            <div className="w-full bg-white rounded-2xl overflow-hidden px-1">
                <div className="flex flex-col lg:flex-row lg:items-start px-2 py-5 gap-6">
                    {/* Left Section */}
                    <div className="flex-1 min-w-0 lg:mr-14">
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
                                {item.pickupLocationTitle}
                            </span>

                            <span className="text-sm text-muted-foreground text-center whitespace-nowrap">
                                {durationText}
                            </span>

                            <span className="text-sm text-end text-muted-foreground whitespace-nowrap">
                                {item.dropoffLocationTitle}
                            </span>
                        </div>

                        <button
                            onClick={openSheet}
                            className="mt-4 text-sm font-medium text-neutral-800 underline underline-offset-2 hover:text-black cursor-pointer"
                        >
                            Trip details
                        </button>
                    </div>

                    {/* Right Section */}
                    <div className="flex gap-3 shrink-0">
                        <div
                            onClick={hasDeparted ? undefined : () => handleBook("car")}
                            className={`w-[160px] rounded-xl border px-4 py-2.5 transition  ${hasDeparted
                                ? "cursor-not-allowed"
                                : "border-neutral-200 bg-white hover:border-black cursor-pointer"
                                }`}
                        >
                            <p className="text-sm text-neutral-500 flex items-center gap-2">
                                Car
                                {isCreatingCheckout && bookingVehicleType === "car" && (
                                    <Spinner className="h-4 w-4 animate-spin" />
                                )}
                            </p>

                            <p className="mt-2 text-xl font-medium text-neutral-900">
                                {hasDeparted ? <span className="text-sm text-muted-foreground font-normal">Not available</span> : formatPrice(item.priceCar + TRANSACTION_FEE)}
                            </p>
                        </div>

                        <div
                            onClick={hasDeparted ? undefined : () => handleBook("bus")}
                            className={`w-[160px] rounded-xl border px-4 py-2.5 transition ${hasDeparted
                                ? "cursor-not-allowed"
                                : "border-neutral-200 bg-white hover:border-black cursor-pointer"
                                }`}
                        >
                            <p className="text-sm text-neutral-500 flex items-center gap-2">
                                Bus
                                {isCreatingCheckout && bookingVehicleType === "bus" && (
                                    <Spinner className="h-4 w-4 animate-spin" />
                                )}
                            </p>

                            <p className="mt-2 text-xl font-medium text-neutral-900">
                                {hasDeparted ? <span className="text-sm text-muted-foreground font-normal">Not available</span> : formatPrice(item.priceBus + TRANSACTION_FEE)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <TripDetailsSheet
                trip={tripForSheet}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                bookingContext={{
                    routeId: item.routeId,
                    tripDate: bookingDate,
                    remainingSeats: 0,
                }}
                showDriverDetails={false}
            />
        </>
    );
};

export default TripCardItem;