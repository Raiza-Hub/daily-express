"use client";
import { useState } from "react";

export default function TripStatusFilter() {
    const [bookingRef, setBookingRef] = useState("");
    const [lastName, setLastName] = useState("");

    const handleRetrieve = () => {
        // TODO: handle retrieve booking logic
        console.log({ bookingRef, lastName });
    };

    return (
        <>
            <div className="">
                <div className="flex flex-col lg:flex-row items-stretch gap-2">
                    {/* Booking Reference */}
                    <div className="relative flex-auto bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center focus-within:ring-2 focus-within:ring-blue-500 transition">
                        <label htmlFor="bookingRef" className="text-xs text-neutral-400">Booking reference</label>
                        <input
                            id="bookingRef"
                            value={bookingRef}
                            onChange={(e) => setBookingRef(e.target.value)}
                            placeholder="Enter booking reference"
                            className="w-full text-sm font-medium bg-transparent outline-none"
                        />
                    </div>

                    {/* Last Name */}
                    <div className="relative flex-auto bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center focus-within:ring-2 focus-within:ring-blue-500 transition">
                        <label htmlFor="lastName" className="text-xs text-neutral-400">Last name</label>
                        <input
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Enter last name"
                            className="w-full text-sm font-medium bg-transparent outline-none"
                        />
                    </div>

                    {/* Retrieve Button */}
                    <button
                        type="button"
                        onClick={handleRetrieve}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-medium cursor-pointer whitespace-nowrap transition-colors w-full lg:w-auto"
                    >
                        Retrieve booking
                    </button>
                </div>
            </div>
        </>
    );
}
