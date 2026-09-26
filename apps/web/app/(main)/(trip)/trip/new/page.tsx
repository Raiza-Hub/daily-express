import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NewTripBooking from "~/components/trip/new-trip-booking";
import { fetchOrigins } from "~/lib/origins";
import { tripTitle } from "~/lib/trip-title";

interface TripNewPageProps {
  searchParams: Promise<{ origin?: string | string[] }>;
}

export async function generateMetadata({
  searchParams,
}: TripNewPageProps): Promise<Metadata> {
  const { origin } = await searchParams;
  const originTitle = Array.isArray(origin) ? origin[0] : origin;

  if (originTitle) {
    const origins = await fetchOrigins();
    if (!origins.some((item) => item.title === originTitle)) {
      notFound();
    }
  }

  return { title: { absolute: tripTitle(originTitle) } };
}

export default async function TripNewPage({
  searchParams,
}: TripNewPageProps) {
  const origins = await fetchOrigins();
  const { origin } = await searchParams;
  const originTitle = Array.isArray(origin) ? origin[0] : origin;

  if (originTitle && !origins.some((item) => item.title === originTitle)) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-10 py-8">
      <div>
        <h1 className="my-4 text-3xl font-semibold text-center tracking-tight text-neutral-900">
          Book a trip
        </h1>
      </div>
      <NewTripBooking initialOrigins={origins} />
    </div>
  );
}
