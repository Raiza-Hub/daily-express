import type { Metadata } from "next";
import { Suspense } from "react";
import TripSearchBar from "~/components/trip/TripSearchBar";
import TripSearchSection from "~/components/trip/TripSearchSection";
import { buildWebMetadata } from "~/lib/seo";

export const metadata: Metadata = buildWebMetadata({
  title: "Find Trips",
  path: "/",
});

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
