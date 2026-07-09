"use client";

import { useEffect, useMemo, useRef } from "react";
import { CircleNotchIcon, ReceiptIcon } from "@phosphor-icons/react";
import { useGetUserBookingsInfinite } from "@repo/api";
import { groupByDate, transformToTripStatusItem } from "~/lib/utils";
import { TripStatusItem } from "~/lib/type";
import TripStatusCardItem from "./TripStatusCardItem";


const TripStatusCard = ({
    scrollToBookingId,
}: {
    scrollToBookingId?: string | null;
}) => {
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error,
    } = useGetUserBookingsInfinite();

    const allBookings = useMemo(
        () => data?.pages?.flatMap((page) => page.bookings) ?? [],
        [data],
    );
    const tripStatusItems: TripStatusItem[] = allBookings
        .map(transformToTripStatusItem)
        .filter((item): item is TripStatusItem => item !== null);
    const grouped = groupByDate(tripStatusItems);

    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry?.isIntersecting) {
                    fetchNextPage();
                }
            },
            { threshold: 0.1 },
        );

        observer.observe(sentinelRef.current);

        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    useEffect(() => {
        if (!scrollToBookingId) return;

        const exists = allBookings.some((b) => b.id === scrollToBookingId);

        if (!exists && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [scrollToBookingId, allBookings, hasNextPage, isFetchingNextPage, fetchNextPage]);

    return (
        <div className="flex flex-col gap-8 pt-6">
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <CircleNotchIcon className="w-6 h-6 animate-spin text-neutral-500" />
                </div>
            ) : isError ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20">
                    <p className="text-red-500">Failed to load bookings</p>
                    <p className="text-sm text-gray-500">Something went wrong</p>
                </div>
            ) : tripStatusItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-20">
                    <ReceiptIcon className="w-6 h-6 text-neutral-500" />
                    <p className="text-neutral-500">No bookings found</p>
                    <p className="text-sm text-neutral-400">Your trip bookings will appear here</p>
                </div>
            ) : (
                <>
                    {Array.from(grouped.entries()).map(([dateLabel, items]) => (
                        <div key={dateLabel} className="flex flex-col gap-3">
                            <h3 className="text-base font-semibold text-neutral-700">
                                {dateLabel}
                            </h3>

                            {items.map((item) => (
                                <TripStatusCardItem
                                    key={item.id}
                                    item={item}
                                    scrollToBookingId={scrollToBookingId ?? undefined}
                                />
                            ))}
                        </div>
                    ))}

                    {isFetchingNextPage && (
                        <div className="flex justify-center py-4">
                            <CircleNotchIcon className="w-6 h-6 animate-spin text-neutral-500" />
                        </div>
                    )}
                    {hasNextPage && !isFetchingNextPage && (
                        <div ref={sentinelRef} className="h-px" />
                    )}

                </>
            )}
        </div>
    );
}

export default TripStatusCard;
