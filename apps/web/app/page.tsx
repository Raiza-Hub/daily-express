import type { Metadata } from "next";
import Navbar from "~/components/Navbar";
import SettingNavTabs from "~/components/NavTabs";
import TripSearchSection from "./components/trip/TripSearchSection";
import Footer from "@repo/ui/Footer";
import { buildHomeMetadataFromSearchParams } from "./lib/seo";
import TripSearchBar from "./components/trip/TripSearchBar";
import { Suspense } from "react";

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
    <div className="w-full min-h-screen flex flex-col">
      <div className="bg-white sticky top-0 z-50">
        <Navbar />
        <div className="bg-gray-50 border-b border-neutral-200 flex flex-col">
          <SettingNavTabs />
        </div>
      </div>

      <main className="w-full max-w-7xl mx-auto flex flex-col px-4 py-6 gap-6 flex-1">
        <Suspense fallback={null}>
          <TripSearchBar />
          <TripSearchSection />
        </Suspense>
      </main>

      <Footer className="max-w-7xl mx-auto w-full mt-auto" />
    </div>
  );
}
