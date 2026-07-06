import type { Metadata } from "next";
import TripStatusPageClient from "./TripStatusPageClient";
import { buildWebMetadata } from "../../lib/seo";

export const metadata: Metadata = buildWebMetadata({
    title: "Trip Status",
    description:
        "Review your Daily Express bookings, trip dates, and current travel status.",
    path: "/trip-status",
    noIndex: true,
});

const Page = () => {
    return (
        <div className="w-full max-w-3xl mx-auto">
            <TripStatusPageClient />
        </div>
    );
};

export default Page;
