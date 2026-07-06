"use client";

import { useState } from "react";
import TripStatusCard from "~/components/trip/TripStatusCard";
import TripStatusFilter from "~/components/trip/TripStatusFilter";

const TripStatusPageClient = () => {
    const [scrollToBookingId, setScrollToBookingId] = useState<string | null>(null);

    return (
        <>
            <div className="mb-8">
                <TripStatusFilter
                    onSearchStart={() => setScrollToBookingId(null)}
                    onBookingFound={(id) => setScrollToBookingId(id)}
                />
            </div>
            <TripStatusCard scrollToBookingId={scrollToBookingId} />
        </>
    );
};

export default TripStatusPageClient;
