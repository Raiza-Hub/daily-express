"use client";

import { useMemo, useState } from "react";
import { format, parse } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Select } from "~/components/ui/select";
import { TrailCard } from "~/components/ui/trail-card";
import { BookingDetailsDrawer } from "~/components/trip/booking-details-drawer";
import { formatTripTime } from "~/lib/trip";
import {
  MOCK_BOOKINGS,
  STATUS_LABELS,
  type BookingStatus,
  type TripBooking,
} from "~/lib/trip-bookings";

const lampImage =
  "https://motion-primitives.com/eb-27-lamp-edouard-wilfrid-buquet.jpg";

export default function TripBookings() {
  const bookingYears = useMemo(
    () =>
      [...new Set(MOCK_BOOKINGS.map((b) => Number(b.tripDate.slice(0, 4))))].sort(
        (a, b) => a - b,
      ),
    [],
  );

  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">(
    "all",
  );
  const [selectedBooking, setSelectedBooking] = useState<TripBooking | null>(
    null,
  );

  const visibleBookings = useMemo(
    () =>
      MOCK_BOOKINGS.filter((booking) => {
        const yearOk =
          selectedYear === "all" ||
          Number(booking.tripDate.slice(0, 4)) === selectedYear;
        const statusOk =
          statusFilter === "all" || booking.status === statusFilter;
        return yearOk && statusOk;
      }),
    [selectedYear, statusFilter],
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
              setStatusFilter(event.target.value as BookingStatus | "all")
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
                  imageUrl={lampImage}
                  origin={booking.origin}
                  originLabel="Origin"
                  destination={booking.destination}
                  destinationLabel="Destination"
                  date={format(
                    parse(booking.tripDate, "yyyy-MM-dd", new Date()),
                    "MMM d, yyyy",
                  )}
                  departureTime={formatTripTime(booking.departureTime)}
                  fare={`₦${booking.price.toLocaleString("en-NG")}`}
                  onClick={() => setSelectedBooking(booking)}
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
              No bookings found for the selected filters.
            </motion.p>
          </AnimatePresence>
        )}
      </section>

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