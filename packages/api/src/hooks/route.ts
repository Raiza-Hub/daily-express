import {
  useMutation,
  useQuery,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { routeApi } from "../api";
import type {
  Route,
  Trip,
  Booking,
  ApiResponse,
  CreateRoute,
  updateRouteRequest,
  CreateTrip,
  updateBookingRequest,
} from "@shared/types";
import { handleApiError } from "../utils";

export const getAllDriverRoutesFn = async (): Promise<Route[]> => {
  try {
    const response = await routeApi.get<ApiResponse<Route[]>>(
      "/route/driver/routes",
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get driver routes");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get driver routes") as never;
  }
};

export const createRouteFn = async (data: CreateRoute): Promise<Route> => {
  try {
    const response = await routeApi.post<ApiResponse<Route>>(
      "/route/create/driver/route",
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to create route");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to create route") as never;
  }
};

export const updateRouteFn = async ({
  id,
  data,
}: {
  id: string;
  data: updateRouteRequest;
}): Promise<Route> => {
  try {
    const response = await routeApi.put<ApiResponse<Route>>(
      `/route/update/driver/route/${id}`,
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to update route");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to update route") as never;
  }
};

export const deleteRouteFn = async (id: string): Promise<void> => {
  try {
    const response = await routeApi.delete<ApiResponse<null>>(
      `/route/driver/route/${id}`,
    );
    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to delete route");
    }
  } catch (err) {
    return handleApiError(err, "Failed to delete route") as never;
  }
};

export const getRouteFn = async (id: string): Promise<Route> => {
  try {
    const response = await routeApi.get<ApiResponse<Route>>(`/route/get/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get route");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get route") as never;
  }
};

export const getAllTripsFn = async (date: string): Promise<Trip[]> => {
  try {
    const response = await routeApi.get<ApiResponse<Trip[]>>(
      `/route/driver/trips/${date}`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get trips");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get trips") as never;
  }
};

export interface TripsSummary {
  date: string;
  totalEarnings: number;
  totalTrips: number;
  totalPassengers: number;
  trips: Array<{
    id: string;
    date: Date;
    bookedSeats: number;
    status: string;
    route: {
      id: string;
      pickup_location_title: string;
      dropoff_location_title: string;
      price: number;
    };
    earnings: number;
  }>;
}

export const getTripsSummaryFn = async (
  date: string,
): Promise<TripsSummary> => {
  try {
    const response = await routeApi.get<ApiResponse<TripsSummary>>(
      `/route/driver/trips-summary/${date}`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get trips summary");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get trips summary") as never;
  }
};

export const updateTripStatusFn = async ({
  id,
  status,
}: {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
}): Promise<Trip> => {
  try {
    const response = await routeApi.patch<ApiResponse<Trip>>(
      `/route/driver/trip/${id}`,
      { status },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to update trip status");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to update trip status") as never;
  }
};

export const getAllUserRoutesFn = async (): Promise<Route[]> => {
  try {
    const response =
      await routeApi.get<ApiResponse<Route[]>>("/route/user/routes");
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get user routes");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get user routes") as never;
  }
};

export const searchRoutesFn = async (
  params: {
    from?: string;
    to?: string;
    vehicleType?: string[];
  },
  offset: number = 0,
  limit: number = 20,
): Promise<Route[]> => {
  try {
    const searchParams = new URLSearchParams();
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
    if (params.vehicleType && params.vehicleType.length > 0) {
      searchParams.set("vehicleType", params.vehicleType.join(","));
    }
    searchParams.set("limit", String(limit));
    searchParams.set("offset", String(offset));

    const response = await routeApi.get<ApiResponse<Route[]>>(
      `/route/search?${searchParams.toString()}`,
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
  params: {
    from?: string;
    to?: string;
    vehicleType?: string[];
  };
  enabled: boolean;
}) => {
  return useInfiniteQuery({
    queryKey: ["search-routes", params],
    queryFn: ({ pageParam = 0 }: { pageParam?: number }) =>
      searchRoutesFn(params, pageParam ?? 0, ROUTES_PAGE_SIZE),
    getNextPageParam: (lastPage: Route[]) => {
      if (lastPage.length === ROUTES_PAGE_SIZE) {
        return lastPage.length;
      }
      return undefined;
    },
    initialPageParam: 0,
    retry: false,
    enabled,
  });
};

export const bookTripFn = async (data: CreateTrip): Promise<Booking> => {
  try {
    const response = await routeApi.post<ApiResponse<Booking>>(
      "/route/user/trip",
      data,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to book trip");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to book trip") as never;
  }
};

export const updateBookingStatusFn = async ({
  id,
  status,
}: {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
}): Promise<Booking> => {
  try {
    const response = await routeApi.patch<ApiResponse<Booking>>(
      `/route/user/booking/${id}`,
      { status },
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to update booking");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to update booking") as never;
  }
};

export const getUserBookingsFn = async (): Promise<Booking[]> => {
  try {
    const response = await routeApi.get<ApiResponse<Booking[]>>(
      "/route/user/bookings",
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get user bookings");
    }
    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to get user bookings") as never;
  }
};

export const useGetAllDriverRoutes = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["driverRoutes"],
    queryFn: getAllDriverRoutesFn,
    retry: false,
    enabled: options?.enabled ?? true,
  });
};

export const useCreateRoute = (options?: {
  onSuccess?: (data: Route) => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: createRouteFn,
    ...options,
  });
};

export const useUpdateRoute = (options?: {
  onSuccess?: (data: Route) => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRouteFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["driverRoutes"] });
      queryClient.invalidateQueries({ queryKey: ["userRoutes"] });
      queryClient.invalidateQueries({ queryKey: ["route", data.id] });
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
};

export const useDeleteRoute = (options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: deleteRouteFn,
    ...options,
  });
};

export const useGetRoute = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["route", id],
    queryFn: () => getRouteFn(id),
    retry: false,
    enabled: options?.enabled ?? !!id,
  });
};

export const useGetAllTrips = (
  date: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["trips", date],
    queryFn: () => getAllTripsFn(date),
    retry: false,
    enabled: options?.enabled ?? !!date,
  });
};

export const useUpdateTripStatus = (options?: {
  onSuccess?: (data: Trip) => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: updateTripStatusFn,
    ...options,
  });
};

export const useGetAllUserRoutes = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["userRoutes"],
    queryFn: getAllUserRoutesFn,
    retry: false,
    enabled: options?.enabled ?? true,
  });
};

export const useBookTrip = (options?: {
  onSuccess?: (data: Booking) => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: bookTripFn,
    ...options,
  });
};

export const useUpdateBookingStatus = (options?: {
  onSuccess?: (data: Booking) => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: updateBookingStatusFn,
    ...options,
  });
};

export const useGetUserBookings = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["userBookings"],
    queryFn: getUserBookingsFn,
    retry: false,
    enabled: options?.enabled ?? true,
  });
};

export const useGetTripsSummary = (
  date: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["tripsSummary", date],
    queryFn: () => getTripsSummaryFn(date),
    retry: false,
    enabled: options?.enabled ?? !!date,
  });
};
