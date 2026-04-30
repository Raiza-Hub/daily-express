"use client";

import { CircleNotchIcon, ReceiptIcon } from "@phosphor-icons/react";
import { useGetUserBookingsInfinite } from "@repo/api";
import { Button } from "@repo/ui/components/button";
import { useMemo } from "react";
import { groupByDate, transformToTripStatusItem } from "~/lib/utils";
import { TripStatusItem } from "~/lib/type";
import TripStatusCardItem from "./TripStatusCardItem";


const TripStatusCard = () => {
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error,
    } = useGetUserBookingsInfinite();

    const allBookings = useMemo(() => {
        if (!data?.pages) return [];
        return data.pages.flatMap((page) => page.bookings);
    }, [data]);

    const tripStatusItems = useMemo(() => {
        return allBookings
            .map(transformToTripStatusItem)
            .filter((item): item is TripStatusItem => item !== null);
    }, [allBookings]);

    const grouped = useMemo(() => {
        return groupByDate(tripStatusItems);
    }, [tripStatusItems]);

    return (
        <div className="flex flex-col gap-8 pt-6">
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <CircleNotchIcon className="w-6 h-6 animate-spin text-neutral-500" />
                </div>
            ) : isError ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20">
                    <p className="text-red-500">Failed to load bookings</p>
                    <p className="text-sm text-gray-500">{(error as Error)?.message}</p>
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
                                <TripStatusCardItem key={item.id} item={item} />
                            ))}
                        </div>
                    ))}

                    {hasNextPage && (
                        <div className="flex justify-center py-4">
                            <Button
                                variant="outline"
                                onClick={() => fetchNextPage()}
                                disabled={isFetchingNextPage}
                            >
                                {isFetchingNextPage ? (
                                    <span className="flex items-center gap-2">
                                        <CircleNotchIcon className="w-6 h-6 animate-spin" />
                                        Loading more...
                                    </span>
                                ) : (
                                    "Load more"
                                )}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default TripStatusCard;
