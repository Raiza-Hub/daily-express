"use client"

import * as React from "react"
import dayjs from "dayjs"
import { cn } from "@repo/ui/lib/utils"
import { Button } from "@repo/ui/components/button"
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"


interface CalendarTwinProps {
    value?: Date
    onChange?: (date: Date) => void
    className?: string
    yearRange?: [number, number]
}

export function CalendarTwin({
    value,
    onChange,
    className,
    yearRange = [2000, 2035],
}: CalendarTwinProps) {
    const [view, setView] = React.useState<"month" | "year">("month")
    const [current, setCurrent] = React.useState<Date>(value ?? new Date())

    const currentDay = dayjs(current)

    const handleSelect = (date: Date) => {
        onChange?.(date)
    }

    const goPrev = () => {
        if (view === "month") {
            setCurrent(currentDay.subtract(1, "month").toDate())
        } else {
            setCurrent(currentDay.subtract(12, "year").toDate())
        }
    }

    const goNext = () => {
        if (view === "month") {
            setCurrent(currentDay.add(1, "month").toDate())
        } else {
            setCurrent(currentDay.add(12, "year").toDate())
        }
    }

    const renderMonth = (monthDate: Date) => {
        const month = dayjs(monthDate)
        const startOfMonth = month.startOf("month")
        const endOfMonth = month.endOf("month")

        const days: Date[] = []
        for (let i = 1; i <= endOfMonth.date(); i++) {
            days.push(month.date(i).toDate())
        }

        return (
            <div className="w-full">
                <div className="mb-2 text-center text-sm font-medium">
                    {month.format("MMMM YYYY")}
                </div>

                <div className="grid grid-cols-7 text-xs text-muted-foreground">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                        <div key={d} className="h-7 flex items-center justify-center">
                            {d}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7">
                    {Array.from({ length: startOfMonth.day() }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-9" />
                    ))}

                    {days.map((day) => {
                        const isSelected =
                            value &&
                            dayjs(day).isSame(dayjs(value), "day")

                        return (
                            <button
                                key={day.toISOString()}
                                onClick={() => handleSelect(day)}
                                className={cn(
                                    "h-9 w-9 m-0.5 flex items-center justify-center rounded-md text-sm transition-colors",
                                    isSelected
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-accent hover:text-foreground"
                                )}
                            >
                                {dayjs(day).date()}
                            </button>
                        )
                    })}
                </div>
            </div>
        )
    }

    const renderYearGrid = () => {
        const currentYear = currentDay.year()
        const start = Math.max(yearRange[0], currentYear - (currentYear % 12))
        const years = Array.from({ length: 12 }, (_, i) => start + i)

        return (
            <div className="p-2">
                <div className="grid grid-cols-3 gap-2">
                    {years.map((year) => (
                        <button
                            key={year}
                            onClick={() => {
                                const newDate = dayjs(current)
                                    .year(year)
                                    .startOf("year")
                                    .toDate()

                                setCurrent(newDate)
                                setView("month")
                            }}
                            className={cn(
                                "h-10 rounded-md text-sm font-medium transition-colors",
                                year === currentYear
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-accent hover:text-foreground"
                            )}
                        >
                            {year}
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div
            className={cn(
                "rounded-lg border bg-background p-3 w-full max-h-[80vh] md:max-h-none overflow-y-auto md:overflow-visible",
                className
            )}
        >
            <div className="flex items-center justify-between mb-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={goPrev}
                    className="h-8 w-8"
                >
                    <CaretLeftIcon className="h-4 w-4" />
                </Button>

                <button
                    onClick={() =>
                        setView(view === "month" ? "year" : "month")
                    }
                    className="text-sm font-semibold hover:underline"
                >
                    {view === "month"
                        ? currentDay.format("MMMM YYYY")
                        : currentDay.year()}
                </button>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={goNext}
                    className="h-8 w-8"
                >
                    <CaretRightIcon className="h-4 w-4" />
                </Button>
            </div>

            {view === "month" ? (
                <div className="flex flex-col md:flex-row gap-6">
                    {renderMonth(current)}
                    {renderMonth(
                        dayjs(current).add(1, "month").toDate()
                    )}
                </div>
            ) : (
                renderYearGrid()
            )}
        </div>
    )
}
