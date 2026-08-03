import type { Metadata } from "next";
import { Suspense } from "react";
import TripSearchBar from "~/components/trip/TripSearchBar";
import TripSearchSection from "~/components/trip/TripSearchSection";
import { buildHomeMetadataFromSearchParams } from "~/lib/seo";

type HomePageProps = {
  searchParams: Promise<{
    from?: string | string[];
    to?: string | string[];
    date?: string | string[];
    vehicleType?: string | string[];
  }>;
};

export async function generateMetadata({
  searchParams,
}: HomePageProps): Promise<Metadata> {
  return buildHomeMetadataFromSearchParams(await searchParams);
}

export default function Home() {
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">
      <Suspense fallback={null}>
        <TripSearchBar />
        <TripSearchSection />
      </Suspense>
    </div>
  );
}
