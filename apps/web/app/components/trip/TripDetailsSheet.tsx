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
import { toast } from "@repo/ui/components/sonner";
import {
  CarProfileIcon,
  InfoIcon,
  MapPinAreaIcon,
  SpinnerIcon,
  VanIcon,
} from "@phosphor-icons/react";
import { formatPrice, getDuration } from "@repo/ui/lib/utils";
import dayjs from "dayjs";
import { useCreateTripCheckout } from "@repo/api";
import { useRouter } from "next/navigation";
import { combineTripDateAndTime, parseLocalDate } from "~/lib/utils";
import { BookingContext } from "~/lib/type";
import { posthogEvents } from "~/lib/posthog-events";
import { usePostHog } from "posthog-js/react";

const TRANSACTION_FEE_RATE = 0.1;
const WEB_PAYMENT_CHANNELS = ["bank_transfer"] as const;

interface TripDetailsSheetProps {
  trip: TRoute;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingContext?: BookingContext;
  allowBooking?: boolean;
  analyticsContext?: "search_results" | "trip_status";
}

const TripDetailsSheet = ({
  trip,
  open,
  onOpenChange,
  bookingContext,
  allowBooking = true,
}: TripDetailsSheetProps) => {
  const router = useRouter();
  const posthog = usePostHog();
  const duration = getDuration(trip.departureTime, trip.estimatedArrivalTime);
  const transactionFee = trip.price * TRANSACTION_FEE_RATE;
  const selectedTripDate = bookingContext
    ? parseLocalDate(bookingContext.tripDate)
    : trip.departureTime;
  const scheduledDepartureTime = bookingContext
    ? combineTripDateAndTime(selectedTripDate, trip.departureTime)
    : trip.departureTime;
  let scheduledArrivalTime = bookingContext
    ? combineTripDateAndTime(selectedTripDate, trip.estimatedArrivalTime)
    : trip.estimatedArrivalTime;

  if (scheduledArrivalTime <= scheduledDepartureTime) {
    scheduledArrivalTime = dayjs(scheduledArrivalTime).add(1, "day").toDate();
  }

  const departureTime = dayjs(scheduledDepartureTime).format("h:mma");
  const arrivalTime = dayjs(scheduledArrivalTime).format("h:mma");
  const departureDate = dayjs(scheduledDepartureTime).format("ddd, D MMM YYYY");
  const bookingDate = bookingContext
    ? dayjs(selectedTripDate).format("ddd, D MMM YYYY")
    : departureDate;
  const totalAmount = trip.price + transactionFee;
  const hasTripDeparted = () => dayjs().isAfter(scheduledDepartureTime);
  const hasDeparturePassed = hasTripDeparted();

  const { mutateAsync: createTripCheckout, isPending: isCreatingCheckout } =
    useCreateTripCheckout({
      onError: (error) => {
        posthog.captureException(error, {
          action: "book_trip",
          values: {
            failureStage: "payment_initialization",
            routeId: bookingContext?.routeId,
            tripDate: bookingContext?.tripDate,
          },
        });
        const message = error.message;
        const requiresAuthentication =
          message.toLowerCase().includes("login") ||
          message.toLowerCase().includes("authenticated") ||
          message.toLowerCase().includes("session expired");

        if (requiresAuthentication) {
          router.push("/sign-in");
          return;
        }

        toast.error(message);
      },
    });

  const handleBookTrip = async () => {
    if (!bookingContext) {
      return;
    }

    if (hasTripDeparted()) {
      toast.error("This trip has already departed and can no longer be booked.");
      return;
    }

    try {
      posthog.capture(posthogEvents.trip_book_initiated, {
        routeId: bookingContext.routeId,
        tripDate: bookingContext.tripDate,
      });

      const checkout = await createTripCheckout({
        routeId: bookingContext.routeId,
        tripDate: bookingContext.tripDate,
        channels: [...WEB_PAYMENT_CHANNELS],
        productName: `${trip.departureCity.title} to ${trip.arrivalCity.title}`,
        productDescription: `Trip booking for ${bookingDate}`,
        metadata: {
          routeId: bookingContext.routeId,
          tripDate: bookingContext.tripDate,
        },
      });

      if (!checkout.paymentReference || !checkout.checkoutUrl) {
        throw new Error("Payment initialization failed");
      }

      posthog.capture(posthogEvents.payment_initialization_succeeded, {
        checkoutUrl: checkout.checkoutUrl,
      });

      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start payment";
      const requiresAuthentication =
        message.toLowerCase().includes("login") ||
        message.toLowerCase().includes("authenticated") ||
        message.toLowerCase().includes("session expired");

      if (requiresAuthentication) {
        router.push("/sign-in");
        return;
      }

      toast.error(message);
    }
  };

  const isSubmitting = isCreatingCheckout;
  const canBook = allowBooking && Boolean(bookingContext) && !hasDeparturePassed;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full md:max-w-[480px] p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-5 border-b border-gray-100">
          <SheetTitle className="text-center text-base font-normal tracking-wide text-neutral-800">
            Trip details
          </SheetTitle>
          <SheetDescription className="sr-only">
            Trip from {trip.departureCity.title} to {trip.arrivalCity.title}
          </SheetDescription>
        </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="px-6  pb-5 space-y-1">
              <h2 className="text-lg font-bold text-neutral-900">
                {trip.departureCity.title} to {trip.arrivalCity.title}
              </h2>
              <p className="text-sm text-neutral-500">{bookingDate}</p>
            </div>

            <div className="px-6 pb-2">
              <div className="flex gap-4">
                <div className="shrink-0 w-14 flex justify-end items-start">
                  <span className="text-sm font-medium text-neutral-700 select-none leading-none">
                    {departureTime}
                  </span>
                </div>
                <div className="relative shrink-0 w-5 flex flex-col items-center">
                  <div className="relative z-10 w-3.5 h-3.5 rounded-full border-2 border-neutral-400 bg-white shrink-0" />
                  <div className="flex-1 w-px bg-neutral-300" />
                </div>
                <div className="flex-1 flex flex-col pb-5">
                  <p className="font-semibold text-sm text-neutral-900 leading-none">
                    {trip.departureCity.title}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="shrink-0 w-14" />
                <div className="relative shrink-0 w-5 flex flex-col items-center min-h-[90px]">
                  <div className="w-px bg-neutral-300 flex-1" />
                  <div className="relative z-10 bg-white py-1 shrink-0">
                    <MapPinAreaIcon
                      weight="duotone"
                      size={20}
                      className="text-neutral-500"
                    />
                  </div>
                  <div className="w-px bg-neutral-300 flex-1" />
                </div>
                <div className="flex-1 flex items-center py-4">
                  <p className="text-sm text-neutral-900">
                    {trip.meetingPoint} to board vehicle
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="shrink-0 w-14 flex justify-start items-center">
                  <span className="text-sm text-neutral-700 select-none">
                    {duration}
                  </span>
                </div>
                <div className="relative shrink-0 w-5 flex flex-col items-center min-h-[90px]">
                  <div className="w-px bg-neutral-300 flex-1" />
                  <div className="relative z-10 bg-white py-1 shrink-0">
                    {trip.vehicleType === "bus" ? (
                      <VanIcon
                        weight="duotone"
                        size={20}
                        className="text-neutral-500"
                      />
                    ) : (
                      <CarProfileIcon
                        weight="duotone"
                        size={20}
                        className="text-neutral-500"
                      />
                    )}
                  </div>
                  <div className="w-px bg-neutral-300 flex-1" />
                </div>
                <div className="flex-1 flex items-center py-4">
                  <p className="flex items-center gap-2 text-sm text-neutral-900 capitalize font-medium">
                    {trip.vehicleType}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {trip.seatNumber} total seats
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="shrink-0 w-14 flex justify-end items-end">
                  <span className="text-sm font-medium text-neutral-700 select-none leading-none">
                    {arrivalTime}
                  </span>
                </div>
                <div className="relative shrink-0 w-5 flex flex-col items-center">
                  <div className="w-px bg-neutral-300 flex-1" />
                  <div className="relative z-10 w-3.5 h-3.5 rounded-full border-2 border-neutral-400 bg-white shrink-0" />
                </div>
                <div className="flex-1 flex flex-col justify-end pt-5">
                  <p className="font-semibold text-sm text-neutral-900 leading-none">
                    {trip.arrivalCity.title}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-6 space-y-4">
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="flex-1 text-neutral-900">Seats left</span>
                  <span className="text-neutral-700">
                    {bookingContext?.remainingSeats}
                  </span>
                </div>
                <div className="flex">
                  <span className="flex-1 text-neutral-900">
                    Transaction fee
                  </span>
                  <span className="text-neutral-700">
                    {formatPrice(transactionFee)}
                  </span>
                </div>
                <div className="flex font-semibold">
                  <span className="flex-1 text-neutral-900">Total</span>
                  <span className="text-neutral-900 text-base">
                    {formatPrice(totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 pb-3">
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <InfoIcon
                weight="fill"
                size={16}
                className="text-amber-600 shrink-0 mt-0.5"
              />
              <p className="text-xs text-amber-800 leading-relaxed">
                If you intend to travel with luggage, please contact the driver
                in advance to confirm availability.
              </p>
            </div>
          </div>

          {allowBooking && (
            <div className="px-6 pb-6 pt-2 border-t border-gray-100">
              <Button
                className="w-full h-12 text-base font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 cursor-pointer"
                disabled={!canBook || isSubmitting}
                onClick={handleBookTrip}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <SpinnerIcon className="animate-spin" />
                    Processing
                  </span>
                ) : hasDeparturePassed ? (
                  "Trip Departed"
                ) : (
                  "Book Trip"
                )}
              </Button>
            </div>
          )}
      </SheetContent>
    </Sheet>
  );
};

export default TripDetailsSheet;
