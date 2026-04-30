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
}

export const getDriverNotificationsFn = async (params?: {
  limit?: number;
  cursor?: string;
  unreadOnly?: boolean;
}): Promise<NotificationsResponse> => {
  try {
    const searchParams = new URLSearchParams();
    if (params?.limit) {
      searchParams.set("limit", String(params.limit));
    }
    if (params?.cursor) {
      searchParams.set("cursor", params.cursor);
    }
    if (params?.unreadOnly) {
      searchParams.set("unreadOnly", "true");
    }

    const response = await notificationApi.get<
      ApiResponse<NotificationsResponse>
    >(
      `/notifications${searchParams.size ? `?${searchParams.toString()}` : ""}`,
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
    >(`/notifications/${id}/read`);

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

export const markAllDriverNotificationsReadFn = async (): Promise<void> => {
  try {
    const response = await notificationApi.post<ApiResponse<null>>(
      "/notifications/read-all",
    );

    if (!response.data.success) {
      throw new Error(
        response.data.error || "Failed to mark notifications as read",
      );
    }
  } catch (err) {
    return handleApiError(err, "Failed to mark notifications as read") as never;
  }
};

export const useDriverNotifications = (params?: {
  limit?: number;
  unreadOnly?: boolean;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: ["driver-notifications", params?.limit, params?.unreadOnly],
    queryFn: () =>
      getDriverNotificationsFn({
        limit: params?.limit,
        unreadOnly: params?.unreadOnly,
      }),
    retry: false,
    enabled: params?.enabled ?? true,
  });
};

export const useDriverNotificationsInfinite = (params?: {
  limit?: number;
  unreadOnly?: boolean;
  enabled?: boolean;
}) => {
  return useInfiniteQuery({
    queryKey: ["driver-notifications", params?.unreadOnly],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getDriverNotificationsFn({
        limit: params?.limit ?? 20,
        cursor: pageParam ?? undefined,
        unreadOnly: params?.unreadOnly,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    retry: false,
    enabled: params?.enabled ?? true,
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

export const useMarkAllDriverNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllDriverNotificationsReadFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["driver-notifications"],
      });
    },
  });
};

export const getVapidPublicKeyFn = async (): Promise<string> => {
  try {
    const response = await notificationApi.get<ApiResponse<string>>(
      "/notifications/push/vapid-public-key",
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(
        response.data.error || "Failed to fetch VAPID public key",
      );
    }

    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to fetch VAPID public key") as never;
  }
};

export const subscribeToPushFn = async (subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> => {
  try {
    const response = await notificationApi.post<ApiResponse<null>>(
      "/notifications/push/subscribe",
      subscription,
    );

    if (!response.data.success) {
      throw new Error(
        response.data.error || "Failed to subscribe to push notifications",
      );
    }
  } catch (err) {
    return handleApiError(
      err,
      "Failed to subscribe to push notifications",
    ) as never;
  }
};

export const unsubscribeFromPushFn = async (
  endpoint: string,
): Promise<void> => {
  try {
    const response = await notificationApi.delete<ApiResponse<null>>(
      "/notifications/push/subscribe",
      { data: { endpoint } },
    );

    if (!response.data.success) {
      throw new Error(
        response.data.error || "Failed to unsubscribe from push notifications",
      );
    }
  } catch (err) {
    return handleApiError(
      err,
      "Failed to unsubscribe from push notifications",
    ) as never;
  }
};

export const useVapidPublicKey = () => {
  return useQuery({
    queryKey: ["vapid-public-key"],
    queryFn: getVapidPublicKeyFn,
    staleTime: Infinity,
  });
};

export const useSubscribeToPush = () => {
  return useMutation({
    mutationFn: subscribeToPushFn,
  });
};

export const useUnsubscribeFromPush = () => {
  return useMutation({
    mutationFn: unsubscribeFromPushFn,
  });
};
