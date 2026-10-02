"use client";

import { useMemo, useState } from "react";
import { format, parse } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  useGetUserBookingsInfinite,
  useQueryClient,
  type UserBookingWithTrip,
} from "@repo/api";
import { Select } from "~/components/ui/select";
import { TrailCard } from "~/components/ui/trail-card";
import { BookingDetailsDrawer } from "~/components/trip/booking-details-drawer";
import { formatTripTime } from "~/lib/trip";
import {
  deriveTripBookingStatus,
  getOriginImage,
  STATUS_LABELS,
  type TripBookingStatus,
} from "~/lib/trip-bookings";

export default function TripBookings() {
  const { data, isPending, isError, refetch } = useGetUserBookingsInfinite();
  const queryClient = useQueryClient();

  const bookings = useMemo(
    () => data?.pages.flatMap((page) => page.bookings) ?? [],
    [data],
  );

  const bookingYears = useMemo(
    () =>
      [...new Set(bookings.map((b) => Number(b.tripDate.slice(0, 4))))].sort(
        (a, b) => a - b,
      ),
    [bookings],
  );

  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TripBookingStatus | "all">(
    "all",
  );
  const [selectedBooking, setSelectedBooking] =
    useState<UserBookingWithTrip | null>(null);

  const visibleBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        const yearOk =
          selectedYear === "all" ||
          Number(booking.tripDate.slice(0, 4)) === selectedYear;
        const statusOk =
          statusFilter === "all" ||
          deriveTripBookingStatus(booking.refundStatus) === statusFilter;
        return yearOk && statusOk;
      }),
    [bookings, selectedYear, statusFilter],
  );

  return (
    <div className="flex w-full flex-col gap-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="my-4 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Bookings
        </h1>
        <div className="flex items-center gap-3">
          <Select
            value={String(selectedYear)}
            onChange={(event) =>
              setSelectedYear(
                event.target.value === "all"
                  ? "all"
                  : Number(event.target.value),
              )
            }
            className="w-28"
            aria-label="Filter by year"
          >
            <option value="all">All dates</option>
            {bookingYears.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as TripBookingStatus | "all")
            }
            className="w-40"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </header>

      <section className="w-full">
        {visibleBookings.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {visibleBookings.map((booking) => (
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
          <AnimatePresence initial={false}>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 text-center text-sm text-muted-foreground"
            >
              {isPending
                ? "Loading your bookings…"
                : isError
                  ? "We couldn't load your bookings."
                  : "No bookings found for the selected filters."}
            </motion.p>
          </AnimatePresence>
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