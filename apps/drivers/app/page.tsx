import Image, { type ImageProps } from "next/image";
import Navbar from "./components/Navbar";
import StatsCard from "./components/StatsCard";
import RouteCard from "./components/route/RouteCard";
import { ProfitCalendar } from "./components/ProfitCalendar";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-20">
        <div className="mx-auto max-w-7xl px-2.5 py-8 space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of your performance and active routes.</p>
          </div>

          <StatsCard />

          <div className="space-y-4">
            {/* <h2 className="text-xl font-semibold text-gray-900">Routes</h2> */}
            <div><ProfitCalendar /></div>
            <RouteCard />
          </div>
        </div>
      </main>
    </>
  );
}
