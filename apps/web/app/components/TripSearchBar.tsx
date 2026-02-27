"use client"

import * as React from "react"
import dayjs from "dayjs"
import { cn } from "@repo/ui/lib/utils"
import { ArrowsLeftRightIcon } from "@phosphor-icons/react"
import { CalendarTwin } from "./CalendarTwin"
import { LocationDropdown } from "@repo/ui/components/location-dropdown"

export function TripSearchBar({ className }: { className?: string }) {
    const [from, setFrom] = React.useState("")
    const [to, setTo] = React.useState("")
    const [departureDate, setDepartureDate] = React.useState(new Date())

    const [showFromDropdown, setShowFromDropdown] = React.useState(false)
    const [showToDropdown, setShowToDropdown] = React.useState(false)
    const [showCalendar, setShowCalendar] = React.useState(false)

    const fromRef = React.useRef<HTMLDivElement>(null)
    const toRef = React.useRef<HTMLDivElement>(null)
    const calendarRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (fromRef.current && !fromRef.current.contains(e.target as Node))
                setShowFromDropdown(false)

            if (toRef.current && !toRef.current.contains(e.target as Node))
                setShowToDropdown(false)

            if (calendarRef.current && !calendarRef.current.contains(e.target as Node))
                setShowCalendar(false)
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
        <div className={cn("w-full", className)}>
            <div className="flex flex-col lg:flex-row items-stretch gap-2">

                {/* FROM */}
                <div
                    ref={fromRef}
                    className="relative flex-auto bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center
                     focus-within:ring-2 focus-within:ring-blue-500 transition"
                >
                    <label className="text-xs text-neutral-400">From</label>
                    <input
                        value={from}
                        onChange={(e) => {
                            setFrom(e.target.value)
                            setShowFromDropdown(true)
                        }}
                        placeholder="City or airport"
                        className="w-full text-sm font-medium bg-transparent outline-none"
                    />

                    <LocationDropdown
                        query={from}
                        visible={showFromDropdown}
                        highlightedIndex={-1}
                        onSelect={(loc) => {
                            setFrom(`${loc.city} ${loc.code}`)
                            setShowFromDropdown(false)
                        }}
                    />
                </div>

                {/* SWAP */}
                <button
                    type="button"
                    onClick={() => {
                        setFrom(to)
                        setTo(from)
                    }}
                    className="self-center p-2 rounded-full border border-neutral-200 hover:bg-neutral-50 cursor-pointer transition-transform duration-400"
                >
                    <ArrowsLeftRightIcon size={18} className="rotate-90 lg:rotate-0" />
                </button>

                {/* TO */}
                <div
                    ref={toRef}
                    className="relative flex-auto bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center
                     focus-within:ring-2 focus-within:ring-blue-500 transition"
                >
                    <label className="text-xs text-neutral-400">To</label>
                    <input
                        value={to}
                        onChange={(e) => {
                            setTo(e.target.value)
                            setShowToDropdown(true)
                        }}
                        placeholder="City or airport"
                        className="w-full text-sm font-medium bg-transparent outline-none"
                    />

                    <LocationDropdown
                        query={to}
                        visible={showToDropdown}
                        highlightedIndex={-1}
                        onSelect={(loc) => {
                            setTo(`${loc.city} ${loc.code}`)
                            setShowToDropdown(false)
                        }}
                    />
                </div>

                {/* DEPARTURE */}
                <div
                    ref={calendarRef}
                    className="relative flex-[1.5] bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center
                     focus-within:ring-2 focus-within:ring-blue-500 transition"
                >
                    <button
                        type="button"
                        onClick={() => setShowCalendar((prev) => !prev)}
                        className="w-full text-left outline-none"
                    >
                        <span className="text-xs text-neutral-400 block">
                            Departure
                        </span>
                        <span className="text-sm font-medium text-neutral-900">
                            {dayjs(departureDate).format("DD MMM YYYY")}
                        </span>
                    </button>

                    {showCalendar && (
                        <div className="absolute top-full right-0 mt-2 z-50">
                            <CalendarTwin
                                value={departureDate}
                                onChange={(date) => {
                                    setDepartureDate(date)
                                    setShowCalendar(false)
                                }}
                                className="shadow-lg"
                            />
                        </div>
                    )}
                </div>

                {/* SEARCH BUTTON */}
                <button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 lg:py-0 rounded-2xl gap-2 font-medium cursor-pointer"
                >
                    Search
                </button>

            </div>
        </div>
    )
}
