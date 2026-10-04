"use client";

import { useState } from "react";
import { format, parse } from "date-fns";
import {
  useGetUserBookingsInfinite,
  useQueryClient,
  type UserBookingWithTrip,
} from "@repo/api";
import { useRouter, usePathname } from "next/navigation";
import { Select } from "~/components/ui/select";
import { TrailCard } from "~/components/ui/trail-card";
import { BookingDetailsDrawer } from "~/components/trip/booking-details-drawer";
import { TripBookingsSkeleton } from "~/components/trip/trip-bookings-skeleton";
import { formatTripTime } from "~/lib/trip";
import {
  getOriginImage,
  STATUS_LABELS,
  type TripBookingStatus,
} from "~/lib/trip-bookings";

export default function TripBookings({
  year,
  status,
}: {
  year?: number;
  status?: TripBookingStatus;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [selectedBooking, setSelectedBooking] =
    useState<UserBookingWithTrip | null>(null);

  const { data, isPending, isError, isPlaceholderData, refetch } =
    useGetUserBookingsInfinite({
      year,
      status,
    });

  const bookings = data?.pages.flatMap((page) => page.bookings) ?? [];
  const availableYears = data?.pages[0]?.availableYears ?? [];

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams();
    if (year !== undefined) params.set("year", String(year));
    if (status) params.set("status", status);
    if (value !== "all") params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="flex w-full flex-col gap-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-50">
          Bookings
        </h1>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="min-w-0 flex-1 sm:flex-none">
            <Select
              value={year === undefined ? "all" : String(year)}
              onChange={(value) => setFilter("year", value)}
              className="w-full sm:w-28 font-semibold"
              aria-label="Filter by year"
              items={[
                { value: "all", label: "All dates" },
                ...availableYears.map((option) => ({
                  value: String(option),
                  label: String(option),
                })),
              ]}
            />
          </div>
          <div className="min-w-0 flex-1 sm:flex-none">
            <Select
              value={status ?? "all"}
              onChange={(value) => setFilter("status", value)}
              className="w-full sm:w-40 font-semibold"
              aria-label="Filter by status"
              items={[
                { value: "all", label: "All statuses" },
                ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
            />
          </div>
        </div>
      </header>

      <section className="w-full">
        {isPending ? (
          <TripBookingsSkeleton />
        ) : bookings.length > 0 ? (
          <div
            className={`grid gap-6 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3 ${
              isPlaceholderData ? "pointer-events-none opacity-60" : "opacity-100"
            }`}
            aria-busy={isPlaceholderData}
          >
            {bookings.map((booking) => (
              <div key={booking.id} className="flex justify-center">
                <TrailCard
                  imageUrl={getOriginImage(booking.trip?.origin?.title)}
                  origin={booking.trip?.origin?.title ?? "Unknown origin"}
                  originLabel="Origin"
                  destination={
                    booking.trip?.destination?.title ?? "Unknown destination"
                  }
                  destinationLabel="Destination"
                  date={format(
                    parse(booking.tripDate, "yyyy-MM-dd", new Date()),
                    "MMM d, yyyy",
                  )}
                  departureTime={formatTripTime(booking.departureTime)}
                  fare={`₦${(booking.totalAmount + booking.totalFee).toLocaleString("en-NG")}`}
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["userBookings"] });
                    setSelectedBooking(booking);
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {isError
              ? "We couldn't load your bookings."
              : "No bookings found for the selected filters."}
          </p>
        )}
      </section>

      {isError ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => refetch()}
            className="cursor-pointer rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      ) : null}

      <BookingDetailsDrawer
        booking={selectedBooking}
        open={selectedBooking !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedBooking(null);
        }}
      />
    </div>
  );
}
