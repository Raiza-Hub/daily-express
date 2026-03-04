"use client"

import dayjs from "dayjs"
import { cn } from "@repo/ui/lib/utils"
import { ArrowsLeftRightIcon } from "@phosphor-icons/react"
import { CalendarTwin } from "../CalendarTwin"
import { LocationDropdown } from "@repo/ui/components/location-dropdown"
import { useState, useRef, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"

export function TripSearchBar({ className }: { className?: string }) {
    const [from, setFrom] = useState("")
    const [to, setTo] = useState("")
    const [departureDate, setDepartureDate] = useState(new Date())

    const [showFromDropdown, setShowFromDropdown] = useState(false)
    const [showToDropdown, setShowToDropdown] = useState(false)
    const [showCalendar, setShowCalendar] = useState(false)

    const fromRef = useRef<HTMLDivElement>(null)
    const toRef = useRef<HTMLDivElement>(null)
    const calendarRef = useRef<HTMLDivElement>(null)
    const mobileCalendarRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (fromRef.current && !fromRef.current.contains(e.target as Node))
                setShowFromDropdown(false)

            if (toRef.current && !toRef.current.contains(e.target as Node))
                setShowToDropdown(false)

            if (
                calendarRef.current && !calendarRef.current.contains(e.target as Node) &&
                (!mobileCalendarRef.current || !mobileCalendarRef.current.contains(e.target as Node))
            )
                setShowCalendar(false)
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Lock body scroll when mobile calendar is open
    useEffect(() => {
        if (showCalendar) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => { document.body.style.overflow = "" }
    }, [showCalendar])

    return (
        <div className={cn("w-full relative", className)}>
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
                        className="w-full text-left outline-none cursor-pointer"
                    >
                        <span className="text-xs text-neutral-400 block">
                            Departure
                        </span>
                        <span className="text-sm font-medium text-neutral-900">
                            {dayjs(departureDate).format("DD MMM YYYY")}
                        </span>
                    </button>

                    {showCalendar && (
                        <div className="absolute top-full right-0 mt-2 z-50 min-w-[600px]">
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

            {/* MOBILE OVERLAY — bottom sheet, small screens only */}
            <AnimatePresence>
                {showCalendar && (
                    <div ref={mobileCalendarRef} className="md:hidden fixed inset-0 z-50 flex flex-col">
                        {/* Backdrop */}
                        <motion.div
                            key="calendar-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                            className="absolute inset-0 bg-black/40"
                            onClick={() => setShowCalendar(false)}
                        />

                        {/* Sheet */}
                        <motion.div
                            key="calendar-sheet"
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="relative mt-auto bg-white rounded-t-2xl p-4 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <span className="text-base font-semibold text-neutral-900">Select departure date</span>
                                <button
                                    type="button"
                                    onClick={() => setShowCalendar(false)}
                                    className="text-sm text-neutral-500 hover:text-neutral-800 transition cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>

                            <CalendarTwin
                                value={departureDate}
                                onChange={(date) => {
                                    setDepartureDate(date)
                                    setShowCalendar(false)
                                }}
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
