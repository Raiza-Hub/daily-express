import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { notificationApi } from "../api";
import type { ApiResponse, DriverNotification } from "@shared/types";
import { handleApiError } from "../utils";

interface NotificationsResponse {
  notifications: DriverNotification[];
  nextCursor: string | null;
  unreadCount: number;
}

export const getDriverNotificationsFn = async (params?: {
  limit?: number;
  cursor?: string;
}): Promise<NotificationsResponse> => {
  try {
    const searchParams = new URLSearchParams();
    if (params?.limit) {
      searchParams.set("limit", String(params.limit));
    }
    if (params?.cursor) {
      searchParams.set("cursor", params.cursor);
    }

    const response = await notificationApi.get<
      ApiResponse<NotificationsResponse>
    >(
      `/${searchParams.size ? `?${searchParams.toString()}` : ""}`,
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(
        response.data.error || "Failed to fetch driver notifications",
      );
    }

    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to fetch driver notifications") as never;
  }
};

export const markDriverNotificationReadFn = async (
  id: string,
): Promise<DriverNotification> => {
  try {
    const response = await notificationApi.patch<
      ApiResponse<DriverNotification>
    >(`/${id}/read`);

    if (!response.data.success || !response.data.data) {
      throw new Error(
        response.data.error || "Failed to mark notification as read",
      );
    }

    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to mark notification as read") as never;
  }
};

export const useDriverNotifications = (params?: {
  limit?: number;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: ["driver-notifications"],
    queryFn: () =>
      getDriverNotificationsFn({
        limit: params?.limit,
      }),
    enabled: params?.enabled ?? true,
  });
};

export const useDriverNotificationsInfinite = (params?: {
  limit?: number;
  enabled?: boolean;
  refetchInterval?: number | false;
}) => {
  return useInfiniteQuery({
    queryKey: ["driver-notifications"],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getDriverNotificationsFn({
        limit: params?.limit ?? 20,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: params?.enabled ?? true,
    refetchInterval: params?.refetchInterval ?? false,
  });
};

export const useMarkDriverNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markDriverNotificationReadFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["driver-notifications"],
      });
    },
  });
};
