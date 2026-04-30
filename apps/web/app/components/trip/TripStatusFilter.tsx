"use client";

import type { Booking } from "@shared/types";
import { useReducer } from "react";

type BookingSearchResult = Pick<
  Booking,
  "paymentReference" | "seatNumber" | "status"
>;

type TripStatusState = {
  bookingRef: string;
  lastName: string;
  isLoading: boolean;
  error: string;
  booking: BookingSearchResult | null;
};

type TripStatusAction =
  | { type: "setBookingRef"; value: string }
  | { type: "setLastName"; value: string }
  | { type: "missingFields" }
  | { type: "searchStarted" }
  | { type: "searchSucceeded"; booking: BookingSearchResult }
  | { type: "searchFailed"; message: string }
  | { type: "searchSettled" };

const initialTripStatusState: TripStatusState = {
  bookingRef: "",
  lastName: "",
  isLoading: false,
  error: "",
  booking: null,
};

function tripStatusReducer(
  state: TripStatusState,
  action: TripStatusAction,
): TripStatusState {
  switch (action.type) {
    case "setBookingRef":
      return { ...state, bookingRef: action.value };
    case "setLastName":
      return { ...state, lastName: action.value };
    case "missingFields":
      return {
        ...state,
        error: "Please enter both booking reference and last name",
      };
    case "searchStarted":
      return { ...state, isLoading: true, error: "", booking: null };
    case "searchSucceeded":
      return { ...state, booking: action.booking };
    case "searchFailed":
      return { ...state, error: action.message };
    case "searchSettled":
      return { ...state, isLoading: false };
  }
}

const TripStatusFilter = () => {
  const [{ bookingRef, lastName, isLoading, error, booking }, dispatch] =
    useReducer(tripStatusReducer, initialTripStatusState);

  const handleRetrieve = async () => {
    if (!bookingRef || !lastName) {
      dispatch({ type: "missingFields" });
      return;
    }

    dispatch({ type: "searchStarted" });

    try {
      const response = await fetch(
        `/api/bookings/search?ref=${encodeURIComponent(
          bookingRef,
        )}&lastName=${encodeURIComponent(lastName)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        dispatch({
          type: "searchFailed",
          message: data.message || "Booking not found",
        });
        return;
      }

      dispatch({ type: "searchSucceeded", booking: data.data });
    } catch {
      dispatch({
        type: "searchFailed",
        message: "Failed to retrieve booking. Please try again.",
      });
    } finally {
      dispatch({ type: "searchSettled" });
    }
  };

  return (
    <>
      <div className="">
        <div className="flex flex-col lg:flex-row items-stretch gap-2">
          <div className="relative flex-auto bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center focus-within:ring-2 focus-within:ring-blue-500 transition">
            <label htmlFor="bookingRef" className="text-xs text-neutral-400">
              Booking reference
            </label>
            <input
              id="bookingRef"
              value={bookingRef}
              onChange={(e) =>
                dispatch({ type: "setBookingRef", value: e.target.value })
              }
              placeholder="e.g. DX-1234567890-ABC"
              className="w-full text-sm font-medium bg-transparent outline-none"
            />
          </div>

          <div className="relative flex-auto bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center focus-within:ring-2 focus-within:ring-blue-500 transition">
            <label htmlFor="lastName" className="text-xs text-neutral-400">
              Last name
            </label>
            <input
              id="lastName"
              value={lastName}
              onChange={(e) =>
                dispatch({ type: "setLastName", value: e.target.value })
              }
              placeholder="Enter last name"
              className="w-full text-sm font-medium bg-transparent outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleRetrieve}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-2xl font-medium cursor-pointer whitespace-nowrap transition-colors w-full lg:w-auto"
          >
            {isLoading ? "Searching..." : "Retrieve booking"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {booking && (
        <div className="mt-4 p-4 bg-white border border-neutral-200 rounded-xl">
          <p className="text-sm font-medium text-neutral-900">
            Booking found! Reference: {booking.paymentReference}
          </p>
          <p className="text-sm text-neutral-500">
            Status: {booking.status} | Seat: {booking.seatNumber}
          </p>
        </div>
      )}
    </>
  );
};

export default TripStatusFilter;
