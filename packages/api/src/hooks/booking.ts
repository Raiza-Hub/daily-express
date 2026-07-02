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
  fareAmount: number;
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
      pickup_location_title: string;
      pickup_location_locality: string;
      pickup_location_label: string;
      dropoff_location_title: string;
      dropoff_location_locality: string;
      dropoff_location_label: string;
      price: number;
      vehicle_type: string;
      meeting_point: string;
      departure_time: string;
      arrival_time: string;
    };
  } | null;
}

export interface UserBookingsPage {
  bookings: UserBookingWithTrip[];
  nextCursor: string | null;
}

export interface SearchRoutesPage {
  routes: Route[];
  nextCursor: string | null;
}

export interface TripsSummaryRange {
  date: string;
  totalEarnings: number;
  totalTrips: number;
  totalPassengers: number;
  trips: Array<{
    id: string;
    date: Date;
    bookedSeats: number;
    capacity: number;
    status: string;
    route: {
      id: string;
      pickup_location_title: string;
      pickup_location_locality: string;
      dropoff_location_title: string;
      dropoff_location_locality: string;
      price: number;
      departure_time: Date;
      arrival_time: Date;
    };
    earnings: number;
  }>;
}

export const getTripsSummaryRangeFn = async (
  startDate: string,
  endDate: string,
): Promise<TripsSummaryRange[]> => {
  try {
    const response = await routeApi.get<ApiResponse<TripsSummaryRange[]>>(
      "/driver/trips-summary-range",
      {
        params: { startDate, endDate },
      },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(
        response.data.error || "Failed to get trips summary range",
      );
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get trips summary range") as never;
  }
};

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
  cursor?: string | null,
  limit: number = 20,
): Promise<SearchRoutesPage> => {
  try {
    const searchParams = new URLSearchParams();
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
    if (params.date) searchParams.set("date", params.date);
    if (params.departureTime) searchParams.set("departureTime", params.departureTime);
    searchParams.set("limit", String(limit));
    if (cursor) {
      searchParams.set("cursor", cursor);
    }

    const response = await routeApi.get<ApiResponse<SearchRoutesPage>>(
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

const ROUTES_PAGE_SIZE = 20;

export const useSearchRoutes = ({
  params,
  enabled,
}: {
  params: SearchRoutesRequest;
  enabled: boolean;
}) => {
  return useInfiniteQuery({
    queryKey: ["search-routes", params],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      searchRoutesFn(params, pageParam, ROUTES_PAGE_SIZE),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
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
    retry: false,
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
      void queryClient.invalidateQueries({ queryKey: ["tripsSummaryRange"] });
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

export const useGetUserBookings = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["userBookings"],
    queryFn: () => getUserBookingsFn(null),
    retry: false,
    enabled: options?.enabled ?? true,
  });
};

export const useGetTripsSummaryRange = (
  startDate: string,
  endDate: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["tripsSummaryRange", startDate, endDate],
    queryFn: () => getTripsSummaryRangeFn(startDate, endDate),
    retry: false,
    enabled: options?.enabled ?? (!!startDate && !!endDate),
    placeholderData: keepPreviousData,
  });
};

interface TripBooking {
  id: string;
  seatNumber: number;
  status: string;
  paymentStatus: string;
  createdAt: Date;
  user: {
    firstName: string;
    lastName: string;
    profilePictureUrl?: string | null;
  };
}

export const getTripBookingsFn = async (
  tripId: string,
): Promise<TripBooking[]> => {
  try {
    const response = await routeApi.get<ApiResponse<TripBooking[]>>(
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
    retry: false,
    enabled: options?.enabled ?? !!tripId,
  });
};

export interface AvailableTrip {
  tripId: string;
  date: Date | string;
  capacity: number;
  bookedSeats: number;
  confirmedBookingCount: number;
  vehicleType: string;
  route: {
    id: string;
    pickup_location_title: string;
    pickup_location_locality: string;
    pickup_location_label: string;
    dropoff_location_title: string;
    dropoff_location_locality: string;
    dropoff_location_label: string;
    departure_time: string;
    arrival_time: string;
    priceCar: number;
    priceBus: number;
    meeting_point: string;
  };
}

export interface AvailableTripsResponse {
  trips: AvailableTrip[];
  nextCursor: string | null;
}

export interface AvailableTripsCountByDateResponse {
  counts: Record<string, number>;
}

export const getAvailableTripsCountByDateFn = async (
  startDate: string,
  endDate: string,
): Promise<AvailableTripsCountByDateResponse> => {
  try {
    const response = await routeApi.get<ApiResponse<AvailableTripsCountByDateResponse>>(
      "/driver/trips/available/calendar",
      { params: { startDate, endDate } },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get available trips count");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to get available trips count");
  }
};

export const getAvailableTripsFn = async (params?: {
  limit?: number;
  cursor?: string;
  search?: string;
  date?: string;
}): Promise<AvailableTripsResponse> => {
  try {
    const response = await routeApi.get<ApiResponse<AvailableTripsResponse>>(
      "/driver/trips/available",
      { params },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get available trips");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to get available trips");
  }
};

export const claimTripFn = async ({
  id,
  vehicleId,
}: {
  id: string;
  vehicleId: string;
}): Promise<{ tripId: string; status: "confirmed" }> => {
  try {
    const response = await routeApi.post<ApiResponse<{ tripId: string; status: "confirmed" }>>(
      `/driver/trip/${id}/claim`,
      { vehicleId },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to claim trip");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to claim trip");
  }
};

export const useGetAvailableTrips = (options?: {
  limit?: number;
  cursor?: string;
  search?: string;
  date?: string;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: ["availableTrips", options?.limit, options?.cursor, options?.search, options?.date],
    queryFn: () => getAvailableTripsFn({ limit: options?.limit, cursor: options?.cursor, search: options?.search, date: options?.date }),
    retry: false,
    enabled: options?.enabled ?? true,
  });
};

export const useGetAvailableTripsInfinite = (options?: {
  search?: string;
  date?: string;
  enabled?: boolean;
  limit?: number;
}) => {
  const limit = options?.limit ?? 20;
  return useInfiniteQuery({
    queryKey: ["availableTrips", limit, options?.search, options?.date],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getAvailableTripsFn({ limit, cursor: pageParam ?? undefined, search: options?.search, date: options?.date }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    retry: false,
    enabled: options?.enabled ?? true,
  });
};

export const useGetAvailableTripsCountByDate = (
  startDate: string,
  endDate: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["availableTripsCount", startDate, endDate],
    queryFn: () => getAvailableTripsCountByDateFn(startDate, endDate),
    retry: false,
    enabled: options?.enabled ?? (!!startDate && !!endDate),
    placeholderData: keepPreviousData,
  });
};

export const useClaimTrip = (options?: {
  onSuccess?: (data: { tripId: string; status: "confirmed" }) => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: claimTripFn,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["availableTrips"] });
      void queryClient.invalidateQueries({ queryKey: ["driverRoutes"] });
      void queryClient.invalidateQueries({ queryKey: ["tripsSummaryRange"] });
      void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
};
