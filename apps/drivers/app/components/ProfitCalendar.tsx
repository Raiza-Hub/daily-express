"use client";

import * as React from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";

dayjs.extend(isoWeek);

// ------------------
// Utils
// ------------------

const getMockAmount = (date: Date) => {
    const seed = date.getDate() + date.getMonth();
    const amounts = [
        "₦656,282",
        "₦659,795",
        "₦1,030,205",
        "₦1,054,490",
        "₦200,677,054",
        "₦656,282",
        "₦1,039,325",
    ];
    return amounts[seed % amounts.length];
};

// ------------------
// Component
// ------------------

export const ProfitCalendar: React.FC = () => {
    const [viewDate, setViewDate] = React.useState(dayjs());
    const [selectedDate, setSelectedDate] = React.useState(dayjs());

    const visibleDays = React.useMemo(() => {
        const start = viewDate.startOf("isoWeek");
        return Array.from({ length: 7 }, (_, i) =>
            start.add(i, "day")
        );
    }, [viewDate]);

    const handlePrev = () => {
        setViewDate((prev) => prev.subtract(1, "week"));
    };

    const handleNext = () => {
        setViewDate((prev) => prev.add(1, "week"));
    };

    const headerLabel = React.useMemo(() => {
        return viewDate.format("MMMM YYYY");
    }, [viewDate]);

    return (
        <div className="w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-base md:text-lg font-semibold text-gray-900">
                    {headerLabel}
                </h2>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePrev}
                        className="h-9 w-9 md:h-8 md:w-8"
                    >
                        <CaretLeftIcon className="h-4 w-4" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNext}
                        className="h-9 w-9 md:h-8 md:w-8"
                    >
                        <CaretRightIcon className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Calendar */}
            <div className="rounded-2xl bg-neutral-50 overflow-x-auto">
                <div className="grid grid-cols-7 divide-x divide-neutral-200 min-w-max">
                    {visibleDays.map((day) => {
                        const isSelected = day.isSame(selectedDate, "day");

                        return (
                            <button
                                key={day.toISOString()}
                                onClick={() => setSelectedDate(day)}
                                className={cn(
                                    "relative flex flex-col items-center justify-center",
                                    "px-1 py-4 md:py-5",
                                    "transition-all duration-200",
                                    "focus:outline-none",
                                    "hover:bg-gray-100/60",
                                    isSelected && "bg-white"
                                )}
                            >
                                {/* Date Label */}
                                <span
                                    className={cn(
                                        "text-xs md:text-sm mb-1",
                                        "text-center",
                                        isSelected ? "text-blue-600" : "text-gray-500"
                                    )}
                                >
                                    {day.format("ddd, D MMM")}
                                </span>

                                {/* Amount */}
                                <span
                                    className={cn(
                                        "text-sm md:text-base font-medium",
                                        isSelected ? "text-blue-600" : "text-gray-900"
                                    )}
                                >
                                    {getMockAmount(day.toDate())}
                                </span>

                                {/* Active Indicator */}
                                {isSelected && (
                                    <div className="absolute bottom-0 left-4 right-4 h-[3px] bg-blue-600 rounded-t-full" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
