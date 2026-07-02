import type { Metadata } from "next";
import AvailableTripsList from "~/components/route/AvailableTripsList";
import { buildDriverMetadata } from "~/lib/seo";

export const metadata: Metadata = buildDriverMetadata({
  title: "Available Trips",
  description: "Claim available trips and routes on Daily Express.",
  path: "/trips/available",
  noIndex: true,
});

export default function AvailableTripsPage() {
  return <AvailableTripsList />;
}
