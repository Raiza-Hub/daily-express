import Navbar from "~/components/Navbar";
import SettingNavTabs from "~/components/NavTabs";
import { TripSearchBar } from "~/components/trip/TripSearchBar";
import TripCard from "./components/trip/TripCard";
import TripFilter from "./components/trip/TripFilter";
import Footer from "@repo/ui/Footer";


export default function Home() {
  return (
    <div className="w-full min-h-screen flex flex-col">
      <div className="bg-white sticky top-0 z-50">
        <Navbar />
        <div className="bg-gray-50 border-b border-neutral-200 flex flex-col">
          <SettingNavTabs />
        </div>
      </div>

      <main className="w-full max-w-7xl mx-auto flex flex-col px-2.5 py-6 gap-6 flex-1">
        <TripSearchBar />

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <TripFilter />
          <div className="flex-1 w-full">
            <TripCard />
          </div>
        </div>
      </main>

      <Footer className="max-w-7xl mx-auto w-full mt-auto" />
    </div>
  );
}
