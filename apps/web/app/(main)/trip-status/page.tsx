import type { Metadata } from "next";
import TripStatusCard from "~/components/trip/TripStatusCard";
import TripStatusFilter from "~/components/trip/TripStatusFilter";
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
        <div className="w-full max-w-4xl mx-auto">
            <div>
                <TripStatusFilter />
            </div>
            <TripStatusCard />
        </div>
    );
};

export default Page;
