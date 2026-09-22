"use client";

import { useCallback, useState } from "react";
import {
    format,
    eachYearOfInterval,
    startOfYear,
    endOfYear,
    eachMonthOfInterval,
    getDaysInMonth,
} from "date-fns";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { motion, AnimatePresence, type Transition } from "framer-motion";

interface CalendarProps {
    selected?: Date;
    onSelect?: (date: Date) => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const stepTransition: Transition = { duration: 0.3, ease: "easeOut" };

function Calendar({ selected, onSelect }: CalendarProps) {
    const today = new Date();
    const [step, setStep] = useState<"year" | "month" | "day">("year");
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
    const [internalDate, setInternalDate] = useState<Date | undefined>(today);
    const [bodyHeight, setBodyHeight] = useState<number | null>(null);
    const selectedDate = selected ?? internalDate;

    const measureStep = useCallback((element: HTMLDivElement | null) => {
        if (element) setBodyHeight(element.offsetHeight);
    }, []);

    // years 1900 → 2100
    const yearRange = eachYearOfInterval({
        start: startOfYear(new Date(1900, 0, 1)),
        end: endOfYear(new Date(2100, 11, 31)),
    });

    const selectDate = (date: Date) => {
        setInternalDate(date);
        onSelect?.(date);
    };

    const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth, 1));
    const firstWeekday = new Date(selectedYear, selectedMonth, 1).getDay();
    const dayCells = [
        ...Array.from({ length: firstWeekday }, () => null),
        ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];

    const isSelectedDay = (day: number) =>
        selectedDate?.getFullYear() === selectedYear &&
        selectedDate.getMonth() === selectedMonth &&
        selectedDate.getDate() === day;

    return (
        <div className="rounded-xl bg-background/80 backdrop-blur-md w-full sm:w-[380px]">
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <h2 className="font-semibold text-lg">
                    {step === "year" && "Select a Year"}
                    {step === "month" && `Year ${selectedYear}`}
                    {step === "day" && format(new Date(selectedYear, selectedMonth, 1), "MMMM yyyy")}
                </h2>

                {/* Breadcrumb buttons */}
                <div className="flex gap-2">
                    <Button
                        variant={step === "year" ? "default" : "outline"}
                        size="sm"
                        className="h-10"
                        onClick={() => setStep("year")}
                    >
                        Year
                    </Button>
                    <Button
                        variant={step === "month" ? "default" : "outline"}
                        size="sm"
                        className="h-10"
                        onClick={() => setStep("month")}
                        disabled={step === "year"} // can't go to month before selecting a year
                    >
                        Month
                    </Button>
                </div>
            </div>

            <motion.div
                initial={false}
                animate={{ height: bodyHeight ?? "auto" }}
                transition={stepTransition}
                className="overflow-hidden"
            >
                <AnimatePresence mode="wait">
                    {step === "year" && (
                        <motion.div
                            key="year"
                            ref={measureStep}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={stepTransition}
                            className="h-80"
                        >
                            <ScrollArea className="h-full">
                                <div className="grid grid-cols-3 gap-2">
                                    {yearRange.map((year) => (
                                        <Button
                                            key={year.getFullYear()}
                                            variant={
                                                year.getFullYear() === selectedYear
                                                    ? "default"
                                                    : "outline"
                                            }
                                            size="sm"
                                            className="h-12"
                                            onClick={() => {
                                                setSelectedYear(year.getFullYear());
                                                setStep("month");
                                            }}
                                        >
                                            {year.getFullYear()}
                                        </Button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </motion.div>
                    )}

                    {step === "month" && (
                        <motion.div
                            key="month"
                            ref={measureStep}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={stepTransition}
                            className="grid grid-cols-3 gap-2"
                        >
                            {eachMonthOfInterval({
                                start: startOfYear(new Date(selectedYear, 0, 1)),
                                end: endOfYear(new Date(selectedYear, 11, 31)),
                            }).map((month) => (
                                <Button
                                    key={month.toISOString()}
                                    variant={
                                        month.getMonth() === selectedMonth
                                            ? "default"
                                            : "outline"
                                    }
                                    size="sm"
                                    className="h-12 flex flex-col"
                                    onClick={() => {
                                        setSelectedMonth(month.getMonth());
                                        setStep("day");
                                    }}
                                >
                                    <span className="text-sm font-medium">
                                        {format(month, "MMM")}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {selectedYear}
                                    </span>
                                </Button>
                            ))}
                        </motion.div>
                    )}

                    {step === "day" && (
                        <motion.div
                            key={`day-${selectedYear}-${selectedMonth}`}
                            ref={measureStep}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={stepTransition}
                        >
                            <div className="rounded-lg bg-card p-3">
                                <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
                                    {WEEKDAYS.map((day) => (
                                        <span key={day} className="py-1">
                                            {day}
                                        </span>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {dayCells.map((day, index) =>
                                        day === null ? (
                                            <span key={`blank-${index}`} />
                                        ) : (
                                            <Button
                                                key={`day-${day}`}
                                                variant={isSelectedDay(day) ? "default" : "outline"}
                                                size="sm"
                                                className="h-12 w-full"
                                                onClick={() => {
                                                    selectDate(new Date(selectedYear, selectedMonth, day));
                                                }}
                                            >
                                                {day}
                                            </Button>
                                        ),
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}

export { Calendar };