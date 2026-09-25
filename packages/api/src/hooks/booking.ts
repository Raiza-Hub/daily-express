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
  DriverInfoResponse,
  Origin,
  OriginDetails,
  Destination,
} from "@shared/types";
import { handleApiError } from "../utils";

export interface UserBookingWithTrip {
  id: string;
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
    date: string;
    status: string;
    bookedSeats: number;
    capacity: number;
    availableSeats: number;
    origin: Origin;
    destination: Destination;
    driver?: any;
    earnings?: number;
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

export const useGetOrigins = () => {
  return useQuery({
    queryKey: ["origins"],
    queryFn: getOriginsFn,
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
    throw handleApiError(err, "Failed to get user bookings") ;
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
    onSuccess: async (data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["driverRoutes"] }),
        queryClient.invalidateQueries({
          queryKey: ["tripBookings", variables.id],
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

type TripBookingsResponse = Array<{
  id: string;
  originId: string;
  destinationId: string;
  tripDate: string;
  departureTime: string;
  luggageCount: number;
  tripId: string | null;
  userId: string;
  totalAmount: number;
  totalFee: number;
  currency: string;
  status: string;
  paymentReference: string | null;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
}>;

export const getTripBookingsFn = async (
  tripId: string,
): Promise<TripBookingsResponse> => {
  try {
    const response = await routeApi.get<ApiResponse<TripBookingsResponse>>(
      `/driver/trip/${tripId}/bookings`,
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to get trip bookings");
    }
    return response.data.data;
  } catch (err) {
    throw handleApiError(err, "Failed to get trip bookings") ;
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


