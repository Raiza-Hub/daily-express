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
  Booking,
  ApiResponse,
  CreateRoute,
  updateRouteRequest,
} from "@shared/types";
import type { DriverStats } from "./driver";
import { handleApiError } from "../utils";

const DRIVER_ROUTES_QUERY_KEY = ["driverRoutes"] as const;
const DRIVER_STATS_QUERY_KEY = ["driverStats"] as const;

type RouteMutationContext = {
  previousRoutes?: Route[];
  previousStats?: DriverStats;
};

function getActiveRouteCount(routes: Route[]) {
  return routes.filter((route) => route.status === "active").length;
}

function syncCachedActiveRoutes(
  queryClient: ReturnType<typeof useQueryClient>,
  routes: Route[],
) {
  queryClient.setQueryData<DriverStats>(DRIVER_STATS_QUERY_KEY, (stats) =>
    stats
      ? {
          ...stats,
          activeRoutes: getActiveRouteCount(routes),
          updatedAt: new Date().toISOString(),
        }
      : stats,
  );
}

function syncCachedRoutes(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (routes: Route[]) => Route[],
) {
  const previousRoutes =
    queryClient.getQueryData<Route[]>(DRIVER_ROUTES_QUERY_KEY);

  if (!previousRoutes) {
    return;
  }

  const nextRoutes = updater(previousRoutes);
  queryClient.setQueryData<Route[]>(DRIVER_ROUTES_QUERY_KEY, nextRoutes);
  syncCachedActiveRoutes(queryClient, nextRoutes);
}

async function invalidateDriverRouteState(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: DRIVER_ROUTES_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: DRIVER_STATS_QUERY_KEY }),
  ]);
}

export interface UserBookingWithTrip {
  id: string;
  seatNumber: number;
  status: string;
  paymentReference: string | null;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
  tripId: string;
  trip: {
    id: string;
    date: Date;
    status: string;
    bookedSeats: number;
    capacity: number;
    availableSeats: number;
    route: {
      id: string;
      pickupLocationTitle: string;
      pickupLocationLocality: string;
      pickupLocationLabel: string;
      dropoffLocationTitle: string;
      dropoffLocationLocality: string;
      dropoffLocationLabel: string;
      price: number;
      vehicleType: string;
      meetingPoint: string;
      departureTime: Date;
      arrivalTime: Date;
      driver: {
        id: string;
        firstName: string;
        lastName: string;
        phoneNumber: string;
        profilePictureUrl: string | null;
        country: string;
        state: string;
      } | null;
    };
  } | null;
}

export interface UserBookingsPage {
  bookings: UserBookingWithTrip[];
  total: number;
}

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
      "/route/driver/trips-summary-range",
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

export const updateTripStatusFn = async ({
  id,
  status,
}: {
  id: string;
  status:
    | "pending"
    | "confirmed"
    | "cancelled"
    | "completed"
    | "booking_closed";
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

export const searchRoutesFn = async (
  params: {
    from?: string;
    to?: string;
    date?: string;
    vehicleType?: string[];
  },
  offset: number = 0,
  limit: number = 20,
): Promise<Route[]> => {
  try {
    const searchParams = new URLSearchParams();
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
    if (params.date) searchParams.set("date", params.date);
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
    date?: string;
    vehicleType?: string[];
  };
  enabled: boolean;
}) => {
  return useInfiniteQuery({
    queryKey: ["search-routes", params],
    queryFn: ({ pageParam = 0 }: { pageParam?: number }) =>
      searchRoutesFn(params, pageParam ?? 0, ROUTES_PAGE_SIZE),
    getNextPageParam: (lastPage: Route[], _allPages, lastPageParam) => {
      if (lastPage.length === ROUTES_PAGE_SIZE) {
        return (lastPageParam ?? 0) + ROUTES_PAGE_SIZE;
      }
      return undefined;
    },
    initialPageParam: 0,
    retry: false,
    enabled,
  });
};

export const getUserBookingsFn = async (
  offset: number = 0,
  limit: number = 20,
): Promise<UserBookingsPage> => {
  try {
    const searchParams = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });

    const response = await routeApi.get<ApiResponse<UserBookingsPage>>(
      `/route/user/bookings?${searchParams.toString()}`,
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
    queryFn: ({ pageParam = 0 }: { pageParam?: number }) =>
      getUserBookingsFn(pageParam ?? 0, limit),
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      const loadedCount = allPages.reduce(
        (total, page) => total + page.bookings.length,
        0,
      );

      if (loadedCount >= lastPage.total || lastPage.bookings.length < limit) {
        return undefined;
      }

      return lastPageParam + limit;
    },
    initialPageParam: 0,
    retry: false,
    enabled: options?.enabled ?? true,
  });
};

export const useGetAllDriverRoutes = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: DRIVER_ROUTES_QUERY_KEY,
    queryFn: getAllDriverRoutesFn,
    retry: false,
    enabled: options?.enabled ?? true,
  });
};

export const useCreateRoute = (options?: {
  onSuccess?: (data: Route) => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRouteFn,
    onSuccess: async (data) => {
      syncCachedRoutes(queryClient, (routes) => [
        data,
        ...routes.filter((route) => route.id !== data.id),
      ]);
      await invalidateDriverRouteState(queryClient);
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
};

export const useUpdateRoute = (options?: {
  onSuccess?: (data: Route) => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRouteFn,
    onSuccess: async (data) => {
      syncCachedRoutes(queryClient, (routes) =>
        routes.map((route) => (route.id === data.id ? data : route)),
      );
      await invalidateDriverRouteState(queryClient);
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
};

export const useDeleteRoute = (options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRouteFn,
    onMutate: async (id): Promise<RouteMutationContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: DRIVER_ROUTES_QUERY_KEY }),
        queryClient.cancelQueries({ queryKey: DRIVER_STATS_QUERY_KEY }),
      ]);

      const previousRoutes =
        queryClient.getQueryData<Route[]>(DRIVER_ROUTES_QUERY_KEY);
      const previousStats =
        queryClient.getQueryData<DriverStats>(DRIVER_STATS_QUERY_KEY);

      syncCachedRoutes(queryClient, (routes) =>
        routes.filter((route) => route.id !== id),
      );

      return { previousRoutes, previousStats };
    },
    onSuccess: () => {
      options?.onSuccess?.();
    },
    onError: (error, _id, context) => {
      if (context?.previousRoutes) {
        queryClient.setQueryData<Route[]>(
          DRIVER_ROUTES_QUERY_KEY,
          context.previousRoutes,
        );
      }

      if (context?.previousStats) {
        queryClient.setQueryData<DriverStats>(
          DRIVER_STATS_QUERY_KEY,
          context.previousStats,
        );
      }

      options?.onError?.(error);
    },
    onSettled: () => {
      void invalidateDriverRouteState(queryClient);
    },
  });
};

export const useUpdateTripStatus = (options?: {
  onSuccess?: (data: Trip) => void;
  onError?: (error: Error) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTripStatusFn,
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["driverRoutes"] });
      void queryClient.invalidateQueries({
        queryKey: ["tripBookings", variables.id],
      });
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
};

export const useGetUserBookings = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["userBookings"],
    queryFn: () => getUserBookingsFn(),
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
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

export const getTripBookingsFn = async (
  tripId: string,
): Promise<TripBooking[]> => {
  try {
    const response = await routeApi.get<ApiResponse<TripBooking[]>>(
      `/route/driver/trip/${tripId}/bookings`,
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
