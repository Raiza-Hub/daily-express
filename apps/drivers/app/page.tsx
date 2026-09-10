import type { Metadata } from "next";
import Navbar from "./components/Navbar";
import { EventCalendarSection } from "./components/EventCalendarSection";
import { buildDriverMetadata } from "./lib/seo";

export const metadata: Metadata = buildDriverMetadata({
  title: "Driver Dashboard",
  description:
    "View your Daily Express route performance, earnings, and driver activity from one dashboard.",
  path: "/",
});

export default async function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 pb-20">
        <EventCalendarSection />
      </main>
    </div>
  );
}
