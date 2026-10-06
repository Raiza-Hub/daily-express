import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { routeApi } from "../api";
import type {
  Trip,
  ApiResponse,
  OriginDetails,
  DriverCalendarTrip,
} from "@shared/types";
import { handleApiError } from "../utils";

export interface TripDriverSummary {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  profilePic: string | null;
}

export interface UserBookingWithTrip {
  id: string;
  tripId: string;
  tripDate: string;
  departureTime: string;
  totalAmount: number;
  totalFee: number;
  refundStatus: string | null;
  trip: {
    bookedSeats: number;
    capacity: number;
    origin: { title: string };
    destination: { title: string };
    driver: TripDriverSummary | null;
  } | null;
}

interface BookingFilters {
  year?: number;
  status?: string;
}

interface UserBookingsPage {
  bookings: UserBookingWithTrip[];
  nextCursor: string | null;
  availableYears: number[];
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
    throw handleApiError(err, "Failed to complete trip") ;
  }
};

export const getOriginsFn = async (): Promise<OriginDetails[]> => {
  try {
    const response = await routeApi.get<ApiResponse<OriginDetails[]>>("/origins");
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get origins");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to get origins");
  }
};

export const useGetOrigins = (options?: { initialData?: OriginDetails[] }) => {
  return useQuery({
    queryKey: ["origins"],
    queryFn: getOriginsFn,
    initialData: options?.initialData,
  });
};

export const getUserBookingsFn = async (
  cursor?: string | null,
  limit: number = 20,
  filters?: BookingFilters,
): Promise<UserBookingsPage> => {
  try {
    const searchParams = new URLSearchParams({
      limit: String(limit),
    });
    if (cursor) {
      searchParams.set("cursor", cursor);
    }
    if (filters?.year !== undefined) {
      searchParams.set("year", String(filters.year));
    }
    if (filters?.status) {
      searchParams.set("status", filters.status);
    }

    const response = await routeApi.get<ApiResponse<UserBookingsPage>>(
      `/user/bookings?${searchParams.toString()}`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get user bookings");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to get user bookings") ;
  }
};

const USER_BOOKINGS_PAGE_SIZE = 20;

export const useGetUserBookingsInfinite = (options?: {
  enabled?: boolean;
  limit?: number;
  year?: number;
  status?: string;
}) => {
  const limit = options?.limit ?? USER_BOOKINGS_PAGE_SIZE;
  const year = options?.year;
  const status = options?.status;

  return useInfiniteQuery({
    queryKey: ["userBookings", limit, year, status],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getUserBookingsFn(pageParam, limit, { year, status }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
};

export const useCompleteTrip = (options?: {
  onSuccess?: (data: Trip) => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeTripFn,
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["driver-payout-balance"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["driver-payout-history"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["driver-payout-summary"],
        }),
      ]);
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
};

export interface TripPassenger {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  carriesLuggage: boolean;
}

interface TripPassengersManifest {
  passengers: TripPassenger[];
}


export const getTripPassengersFn = async (
  tripId: string,
): Promise<TripPassengersManifest> => {
  try {
    const response = await routeApi.get<ApiResponse<TripPassengersManifest>>(
      `/driver/trip/${tripId}/passengers`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get trip passengers");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to get trip passengers");
  }
};

export const useGetTripPassengers = (
  tripId: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["tripPassengers", tripId],
    queryFn: () => getTripPassengersFn(tripId),
    enabled: (options?.enabled ?? true) && !!tripId,
    staleTime: 0,
  });
};


export const getBookingPassengersFn = async (
  bookingId: string,
): Promise<TripPassengersManifest> => {
  try {
    const response = await routeApi.get<ApiResponse<TripPassengersManifest>>(
      `/user/booking/${bookingId}/passengers`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get booking passengers");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to get booking passengers");
  }
};

export const useGetBookingPassengers = (
  bookingId: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["bookingPassengers", bookingId],
    queryFn: () => getBookingPassengersFn(bookingId),
    enabled: (options?.enabled ?? true) && !!bookingId,
    staleTime: 0,
  });
};

export const getDriverTripsFn = async ({
  from,
  to,
}: {
  from: string;
  to: string;
}): Promise<DriverCalendarTrip[]> => {
  try {
    const response = await routeApi.get<ApiResponse<DriverCalendarTrip[]>>(
      "/driver/trips",
      { params: { from, to } },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get driver trips");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to get driver trips");
  }
};

export const useGetDriverTrips = ({
  from,
  to,
}: {
  from: string;
  to: string;
}) => {
  return useQuery({
    queryKey: ["driver-calendar-trips", from, to],
    queryFn: () => getDriverTripsFn({ from, to }),
  });
};

export const initiateTripPayoutFn = async ({
  id,
}: {
  id: string;
}): Promise<Trip> => {
  try {
    const response = await routeApi.post<ApiResponse<Trip>>(
      `/driver/trip/${id}/payout`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to initiate payout");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to initiate payout");
  }
};

export const useInitiateTripPayout = (options?: {
  onSuccess?: (data: Trip) => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: initiateTripPayoutFn,
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["driver-calendar-trips"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["driver-payout-balance"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["driver-payout-history"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["driver-payout-summary"],
        }),
      ]);
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
};

export const cancelTripFn = async ({ id }: { id: string }): Promise<Trip> => {
  try {
    const response = await routeApi.patch<ApiResponse<Trip>>(
      `/driver/trip/${id}/cancel`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to cancel trip");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to cancel trip");
  }
};

export const useCancelTrip = (options?: {
  onSuccess?: (data: Trip) => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelTripFn,
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["driver-calendar-trips"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["tripPassengers", data.id],
        }),
      ]);
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
};

