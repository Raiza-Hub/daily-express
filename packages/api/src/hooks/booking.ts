import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { routeApi } from "../api";
import type {
  Route,
  Trip,
  ApiResponse,
  SearchRoutesRequest,
  DriverInfoResponse,
} from "@shared/types";
import { handleApiError } from "../utils";

export interface UserBookingWithTrip {
  id: string;
  seatNumber: number;
  status: string;
  paymentReference: string | null;
  paymentStatus: string;
  totalAmount: number;
  totalFee: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  tripId: string;
  driverStatus: string;
  displayMessage: string | null;
  driverInfo: DriverInfoResponse | null;
  trip: {
    id: string;
    date: Date;
    status: string;
    bookedSeats: number;
    capacity: number;
    availableSeats: number;
    route: {
      id: string;
      origin_title: string;
      origin_locality: string;
      origin_label: string;
      destination_title: string | null;
      destination_locality: string | null;
      destination_label: string | null;
      train_station_title: string | null;
      train_station_locality: string | null;
      train_station_label: string | null;
      pickup_point: string;
      dropoff_point: string;
      price: number;
      vehicle_type: string;
      departure_time: string;
      arrival_time: string;
      boardingPoint: "pickup" | "dropoff";
      luggageCount: number;
      luggage_fee: number;
    };
  } | null;
}

interface UserBookingsPage {
  bookings: UserBookingWithTrip[];
  nextCursor: string | null;
}

export const completeTripFn = async ({ id }: { id: string }): Promise<Trip> => {
  try {
    const response = await routeApi.patch<ApiResponse<Trip>>(
      `/driver/trip/${id}/complete`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to complete trip");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to complete trip") as never;
  }
};

export const searchRoutesFn = async (
  params: SearchRoutesRequest,
): Promise<Route[]> => {
  try {
    const searchParams = new URLSearchParams();
    if (params.origin) searchParams.set("origin", params.origin);

    const response = await routeApi.get<ApiResponse<Route[]>>(
      `/search?${searchParams.toString()}`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to search routes");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to search routes") as never;
  }
};

export const useSearchRoutes = ({
  params,
  enabled,
}: {
  params: SearchRoutesRequest;
  enabled: boolean;
}) => {
  return useQuery({
    queryKey: ["search-routes", params.origin],
    queryFn: () => searchRoutesFn(params),
    placeholderData: keepPreviousData,
    enabled,
  });
};

export const getUserBookingsFn = async (
  cursor?: string | null,
  limit: number = 20,
): Promise<UserBookingsPage> => {
  try {
    const searchParams = new URLSearchParams({
      limit: String(limit),
    });
    if (cursor) {
      searchParams.set("cursor", cursor);
    }

    const response = await routeApi.get<ApiResponse<UserBookingsPage>>(
      `/user/bookings?${searchParams.toString()}`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get user bookings");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get user bookings") as never;
  }
};

const USER_BOOKINGS_PAGE_SIZE = 20;

export const useGetUserBookingsInfinite = (options?: {
  enabled?: boolean;
  limit?: number;
}) => {
  const limit = options?.limit ?? USER_BOOKINGS_PAGE_SIZE;

  return useInfiniteQuery({
    queryKey: ["userBookings", limit],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getUserBookingsFn(pageParam, limit),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    enabled: options?.enabled ?? true,
  });
};

export const useCompleteTrip = (options?: {
  onSuccess?: (data: Trip) => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeTripFn,
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["driverRoutes"] });
      void queryClient.invalidateQueries({
        queryKey: ["tripBookings", variables.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["driver-payout-balance"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["driver-payout-history"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["driver-payout-summary"],
      });
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
};

interface TripBookingPassenger {
  fullName: string;
  email: string;
  phone: string;
  carriesLuggage: boolean;
}

interface TripBookingEarning {
  amount: number;
  currency: string;
  status: string;
  driverId: string | null;
}

interface TripBookingDetails {
  trip: {
    id: string;
    date: Date;
    status: string;
    departureTime: string;
    arrivalTime: string;
    bookedSeats: number;
    capacity: number;
    origin_label: string;
    origin_title: string;
    destination_title: string | null;
    train_station_title: string | null;
    pickup_point: string;
    dropoff_point: string;
    price: number;
  };
  passengers: TripBookingPassenger[];
  earning: TripBookingEarning | null;
}

export const getTripBookingsFn = async (
  tripId: string,
): Promise<TripBookingDetails> => {
  try {
    const response = await routeApi.get<ApiResponse<TripBookingDetails>>(
      `/driver/trip/${tripId}/bookings`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get trip bookings");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get trip bookings") as never;
  }
};

export const useGetTripBookings = (
  tripId: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["tripBookings", tripId],
    queryFn: () => getTripBookingsFn(tripId),
    enabled: options?.enabled ?? !!tripId,
  });
};


