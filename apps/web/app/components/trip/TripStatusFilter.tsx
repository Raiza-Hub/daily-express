"use client";

import { useReducer } from "react";
import { toast } from "@repo/ui/components/sonner";

type TripStatusState = {
  bookingRef: string;
  lastName: string;
  isLoading: boolean;
};

type TripStatusAction =
  | { type: "setBookingRef"; value: string }
  | { type: "setLastName"; value: string }
  | { type: "searchStarted" }
  | { type: "searchSettled" };

const initialTripStatusState: TripStatusState = {
  bookingRef: "",
  lastName: "",
  isLoading: false,
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
    case "searchStarted":
      return { ...state, isLoading: true };
    case "searchSettled":
      return { ...state, isLoading: false };
  }
}

type Props = {
  onSearchStart?: () => void;
  onBookingFound?: (bookingId: string) => void;
};

const TripStatusFilter = ({ onSearchStart, onBookingFound }: Props) => {
  const [{ bookingRef, lastName, isLoading }, dispatch] =
    useReducer(tripStatusReducer, initialTripStatusState);

  const handleRetrieve = async () => {
    if (!bookingRef || !lastName) {
      toast.error("Please enter both booking reference and last name");
      return;
    }

    onSearchStart?.();
    dispatch({ type: "searchStarted" });

    try {
      const response = await fetch(
        `/api/bookings/search?ref=${encodeURIComponent(
          bookingRef,
        )}&lastName=${encodeURIComponent(lastName)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Booking not found");
        return;
      }

      onBookingFound?.(data.data.id);
    } catch {
      toast.error("Failed to retrieve booking. Please try again.");
    } finally {
      dispatch({ type: "searchSettled" });
    }
  };

  return (
    <div>
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
            placeholder="e.g. 260606180100124386343403"
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
  );
};

export default TripStatusFilter;
