"use client";

import { BuildingOfficeIcon, TrainIcon } from "@phosphor-icons/react";
import { Checkbox } from "@repo/ui/components/checkbox";
import { toast } from "@repo/ui/components/sonner";
import { isApiError, useCreateTripCheckout, useGetMe } from "@repo/api";
import type { Route } from "@shared/types";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseLocalDate } from "~/lib/utils";
import PassengerCard, { type Passenger } from "./PassengerCard";
import ReviewCard from "./ReviewCard";

function isValidNigerianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return (
    (digits.startsWith("0") && digits.length === 11) ||
    (digits.startsWith("234") && digits.length === 13)
  );
}

type TimeMode = "departure" | "arrival";
type BoardingPoint = "pickup" | "dropoff";

const TripBookingCards = ({
  route,
  tripDate,
  timeTab,
}: {
  route: Route;
  tripDate: string;
  timeTab: TimeMode;
}) => {
  const router = useRouter();
  const { data: user } = useGetMe();
  const { mutateAsync: createTripCheckout, isPending: isCreatingCheckout } =
    useCreateTripCheckout();

  const isMock = route.id.startsWith("mock-");

  const [selected, setSelected] = useState<{
    time: string;
    mode: TimeMode;
  } | null>(null);
  const [boardingPoint, setBoardingPoint] = useState<BoardingPoint | null>(null);
  const [leadCarriesLuggage, setLeadCarriesLuggage] = useState(false);
  const [passengers, setPassengers] = useState<Passenger[]>([]);

  const isArrival = timeTab === "arrival";
  const effectiveBoardingPoint: BoardingPoint =
    boardingPoint ?? (isArrival ? "dropoff" : "pickup");
  const boardingLabel =
    effectiveBoardingPoint === "pickup"
      ? route.pickup_point
      : route.dropoff_point;
  const destinationTitle = route.train_station_title ?? route.destination_title;

  const locationBlocks = isArrival
    ? [
        {
          title: "Train Station",
          icon: TrainIcon,
          label:
            route.train_station_label ??
            route.destination_label ??
            "Train Station",
        },
        {
          title: "Destination",
          icon: BuildingOfficeIcon,
          label: route.origin_label,
        },
      ]
    : [
        {
          title: "Origin",
          icon: BuildingOfficeIcon,
          label: route.origin_label,
        },
        {
          title: "Train Station",
          icon: TrainIcon,
          label:
            route.train_station_label ??
            route.destination_label ??
            "Train Station",
        },
      ];

  const slotList = isArrival ? route.arrival_time : route.departure_time;

  const formatTime = (time: string) => {
    const [hours = 0, minutes = 0] = time.split(":").map(Number);
    return dayjs().hour(hours).minute(minutes).format("h:mm A");
  };

  const passengersCount = passengers.length + 1;
  const luggageCount =
    (leadCarriesLuggage ? 1 : 0) +
    passengers.filter((p) => p.carriesLuggage).length;

  const baseTotal =
    ((route.price ?? 0) + (route.fee ?? 0)) * passengersCount;
  const luggageFee = (route.luggage_fee ?? 0) * luggageCount;
  const total = baseTotal + luggageFee;

  const primaryPhone = user?.phone ?? "";
  const primaryFullName = user
    ? `${user.firstName} ${user.lastName}`
    : "";

  const canCheckout = !isMock;

  const handleBook = async () => {
    if (!selected) {
      toast.warning("Pick a departure or arrival time first.");
      return;
    }

    if (!isValidNigerianPhone(primaryPhone)) {
      toast.error(
        "Please add your phone number in Settings → Profile before booking.",
      );
      return;
    }

    if (isMock) {
      toast.success("Booking details saved", {
        description: JSON.stringify(
          {
            route: `${route.origin_title} to ${destinationTitle ?? route.origin_title}`,
            date: tripDate,
            timeMode: selected.mode,
            selectedTime: formatTime(selected.time),
            boardingPoint: effectiveBoardingPoint,
            boardingLabel,
            vehicle: "car",
            price: route.price,
            luggageFee,
            total,
            seats: passengersCount,
            phone: primaryPhone,
            lead: {
              fullName: primaryFullName,
              email: user?.email,
              phone: primaryPhone,
              carriesLuggage: leadCarriesLuggage,
            },
            passengers,
          },
          null,
          2,
        ),
      });
      return;
    }

    try {
      const checkout = await createTripCheckout({
        routeId: route.id,
        tripDate,
        vehicleType: "car",
        seatCount: passengersCount,
        phone: primaryPhone,
        timeMode: selected.mode,
        selectedTime: selected.time,
        boardingPoint: effectiveBoardingPoint,
        luggageCount,
        channels: ["bank_transfer"],
        productName: `${route.origin_title} to ${destinationTitle ?? route.origin_title}`,
        productDescription: `Trip booking for ${dayjs(parseLocalDate(tripDate)).format("ddd, D MMM YYYY")}`,
      });

      if (!checkout.paymentReference || !checkout.checkoutUrl) {
        throw new Error("Payment initialization failed");
      }

      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      if (isApiError(error) && error.statusCode === 401) {
        router.push("/sign-in");
        return;
      }
      const msg = error instanceof Error ? error.message : "Unable to start payment";
      toast.error(msg);
    }
  };

  return (
    <>
      {/* Trip Information Card */}
      <div className="bg-white rounded-2xl p-6">
        <h4 className="text-lg font-semibold text-neutral-900 mb-4">
          Trip Information
        </h4>

        {locationBlocks.map((block) => (
          <div key={block.title} className="mb-4">
            <p className="text-sm font-medium text-neutral-500 flex items-center gap-1.5">
              <block.icon className="size-4" />
              {block.title}
            </p>
            <p className="text-neutral-900">{block.label}</p>
          </div>
        ))}

        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {slotList.map((time) => {
              const isActive =
                selected?.time === time && selected.mode === timeTab;
              return (
                <div
                  key={time}
                  onClick={() => setSelected({ time, mode: timeTab })}
                  className={`rounded-lg px-3 py-2 cursor-pointer border ${
                    isActive
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-neutral-900 border-neutral-200"
                  }`}
                >
                  {formatTime(time)}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm font-medium text-neutral-500 mb-2">
            Boarding Point
          </p>
          <div className="flex flex-wrap gap-2">
            <div
              onClick={() => setBoardingPoint("pickup")}
              className={`rounded-lg px-3 py-2 cursor-pointer border ${
                effectiveBoardingPoint === "pickup"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-neutral-900 border-neutral-200"
              }`}
            >
              <p className="text-sm font-medium">Pickup</p>
              <p className="text-sm opacity-80">{route.pickup_point}</p>
            </div>
            <div
              onClick={() => setBoardingPoint("dropoff")}
              className={`rounded-lg px-3 py-2 cursor-pointer border ${
                effectiveBoardingPoint === "dropoff"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-neutral-900 border-neutral-200"
              }`}
            >
              <p className="text-sm font-medium">Dropoff</p>
              <p className="text-sm opacity-80">{route.dropoff_point}</p>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2">
          <Checkbox
            checked={leadCarriesLuggage}
            onCheckedChange={(value) =>
              setLeadCarriesLuggage(value === true)
            }
          />
          <span className="text-sm text-neutral-700">
            Will you carry luggage?
          </span>
        </label>
      </div>

      {/* Passenger Card */}
      <PassengerCard
        passengers={passengers}
        onPassengersChange={setPassengers}
        leadCarriesLuggage={leadCarriesLuggage}
      />

      {/* Review Card */}
      <ReviewCard
        total={total}
        luggageFee={luggageFee}
        onBook={handleBook}
        isBooking={isCreatingCheckout}
        disabled={
          !selected ||
          isCreatingCheckout ||
          (isMock ? false : !canCheckout)
        }
      />
    </>
  );
};

export default TripBookingCards;