import type { Metadata } from "next";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
import TripSearchBar from "~/components/trip/TripSearchBar";
import { buildWebMetadata } from "~/lib/seo";

export const metadata: Metadata = buildWebMetadata({
  title: "Find Trips",
  path: "/",
});

const Home = () => {
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">
      <TripSearchBar />

      <div className="flex flex-col items-center justify-center gap-2 py-20">
        <MagnifyingGlassIcon className="size-6 text-neutral-500" />
        <p className="text-neutral-500">Where are you headed?</p>
        <p className="text-sm text-center text-neutral-400">
          Pick your starting point and date to find the perfect trip.
        </p>
      </div>
    </div>
  );
}

export default Home;
