import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TripBookings from "~/components/trip/trip-bookings";
import { TRIP_BOOKING_STATUSES, type TripBookingStatus } from "~/lib/trip-bookings";

export const metadata: Metadata = {
  title: "Bookings",
};

interface BookingsPageProps {
  searchParams: Promise<{ year?: string | string[]; status?: string | string[] }>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const { year: rawYear, status: rawStatus } = await searchParams;
  const year = first(rawYear);
  const status = first(rawStatus);

  if (year !== undefined && !/^\d{4}$/.test(year)) {
    notFound();
  }
  if (status !== undefined && !TRIP_BOOKING_STATUSES.includes(status as TripBookingStatus)) {
    notFound();
  }

  return (
    <TripBookings
      year={year ? Number(year) : undefined}
      status={status as TripBookingStatus | undefined}
    />
  );
}