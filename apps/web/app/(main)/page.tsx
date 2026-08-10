import type { Metadata } from "next";
import TripSearchBar from "~/components/trip/TripSearchBar";
import TripSearchSection from "~/components/trip/TripSearchSection";
import { loadSearchParams } from "~/lib/type";
import { buildWebMetadata } from "~/lib/seo";

export const metadata: Metadata = buildWebMetadata({
  title: "Find Trips",
  path: "/",
});

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initial = await loadSearchParams(searchParams);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">
      <TripSearchBar
        initialFrom={initial.from}
        initialTo={initial.to}
        initialDate={initial.date}
      />
      <TripSearchSection
        initialFrom={initial.from}
        initialTo={initial.to}
        initialDate={initial.date}
        initialDepartureTime={initial.departureTime}
      />
    </div>
  );
}
