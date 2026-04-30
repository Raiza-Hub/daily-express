import type { Metadata } from "next";
import Navbar from "./components/Navbar";
import StatsCard from "./components/StatsCard";
import { DashboardRoutes } from "./components/DashboardRoutes";
import Footer from "@repo/ui/Footer";
import { buildDriverMetadata } from "./lib/seo";

export const metadata: Metadata = buildDriverMetadata({
  title: "Driver Dashboard",
  description:
    "View your Daily Express route performance, earnings, and driver activity from one dashboard.",
  path: "/",
  noIndex: true,
});

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 pb-20">
        <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Overview of your performance and active routes.
            </p>
          </div>

          <StatsCard />

          <DashboardRoutes />
        </div>
      </main>
      <Footer className="px-4 md:px-6 mt-auto" />
    </div>
  );
}
