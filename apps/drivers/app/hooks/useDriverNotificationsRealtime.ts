"use client";

import { useGetDriver, useQueryClient } from "@repo/api";
import type {
  DriverNotification,
  DriverNotificationRealtimeEvent,
} from "@shared/types";
import { DRIVER_NOTIFICATION_REALTIME_VERSION } from "@shared/types";
import { useEffect } from "react";
import { useRealtime } from "~/lib/realtime-client";
import { getDriverNotificationChannel } from "~/lib/realtime-shared";

const DRIVER_NOTIFICATIONS_QUERY_KEY = ["driver-notifications"] as const;
const DRIVER_STATS_QUERY_KEY = ["driverStats"] as const;
const DRIVER_ROUTES_QUERY_KEY = ["driverRoutes"] as const;
const TRIPS_SUMMARY_RANGE_QUERY_KEY = ["tripsSummaryRange"] as const;
const BOOKING_CONFIRMED_NOTIFICATION_TYPE = "booking_confirmed";

interface NotificationsPage {
  notifications: DriverNotification[];
  nextCursor: string | null;
}

type NotificationsData = DriverNotification[];
type InfiniteNotificationsData = {
  pages: NotificationsPage[];
  pageParams: (string | null)[];
};

function getNotificationTime(value: Date | string | null | undefined) {
  if (!value) {
    return 0;
  }

  return new Date(value).getTime();
}

function sortNotifications(notifications: DriverNotification[]) {
  return [...notifications].sort((left, right) => {
    const occurredDiff =
      getNotificationTime(right.occurredAt) -
      getNotificationTime(left.occurredAt);

    if (occurredDiff !== 0) {
      return occurredDiff;
    }

    return (
      getNotificationTime(right.createdAt) - getNotificationTime(left.createdAt)
    );
  });
}

function matchesRealtimeEventType(
  event: string,
  data: DriverNotificationRealtimeEvent,
) {
  return (
    data.version === DRIVER_NOTIFICATION_REALTIME_VERSION && data.type === event
  );
}

function invalidateDriverDashboardQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: DRIVER_STATS_QUERY_KEY,
      exact: true,
      refetchType: "active",
    }),
    queryClient.invalidateQueries({
      queryKey: DRIVER_ROUTES_QUERY_KEY,
      exact: true,
      refetchType: "active",
    }),
    queryClient.invalidateQueries({
      queryKey: TRIPS_SUMMARY_RANGE_QUERY_KEY,
      refetchType: "active",
    }),
  ]);
}

export function useDriverNotificationsRealtime() {
  const queryClient = useQueryClient();
  const { data: driver } = useGetDriver();

  const { status } = useRealtime({
    enabled: Boolean(driver?.id),
    channels: driver?.id ? [getDriverNotificationChannel(driver.id)] : [],
    events: [
      "notification.created",
      "notification.read",
      "notification.read_all",
    ],
    onData({ event, data: realtimeData }) {
      if (!matchesRealtimeEventType(event, realtimeData)) {
        return;
      }

      if (event === "notification.created") {
        if (realtimeData.payload.type === BOOKING_CONFIRMED_NOTIFICATION_TYPE) {
          void invalidateDriverDashboardQueries(queryClient);
        }

        queryClient.setQueriesData<
          NotificationsData | InfiniteNotificationsData
        >(
          { queryKey: DRIVER_NOTIFICATIONS_QUERY_KEY },
          (
            current: NotificationsData | InfiniteNotificationsData | undefined,
          ) => {
            if (!current) {
              return {
                pages: [
                  {
                    notifications: [realtimeData.payload],
                    nextCursor: null,
                  },
                ],
                pageParams: [null],
              };
            }

            if ("pages" in current) {
              const updatedPages = current.pages.map(
                (page: NotificationsPage, pageIndex: number) => {
                  if (pageIndex === 0) {
                    return {
                      ...page,
                      notifications: sortNotifications([
                        realtimeData.payload,
                        ...page.notifications.filter(
                          (n: DriverNotification) =>
                            n.id !== realtimeData.payload.id,
                        ),
                      ]),
                    };
                  }
                  return page;
                },
              );

              return {
                ...current,
                pages: updatedPages,
              };
            }

            return sortNotifications([
              realtimeData.payload,
              ...(current as DriverNotification[]).filter(
                (notification: DriverNotification) =>
                  notification.id !== realtimeData.payload.id,
              ),
            ]);
          },
        );
        return;
      }

      if (event === "notification.read") {
        queryClient.setQueriesData<
          NotificationsData | InfiniteNotificationsData
        >(
          { queryKey: DRIVER_NOTIFICATIONS_QUERY_KEY },
          (
            current: NotificationsData | InfiniteNotificationsData | undefined,
          ) => {
            if (!current) {
              return current;
            }

            if ("pages" in current) {
              return {
                ...current,
                pages: current.pages.map((page: NotificationsPage) => ({
                  ...page,
                  notifications: page.notifications.map(
                    (notification: DriverNotification) =>
                      notification.id === realtimeData.payload.id
                        ? {
                            ...notification,
                            readAt:
                              notification.readAt ||
                              new Date(realtimeData.timestamp).toISOString(),
                          }
                        : notification,
                  ),
                })),
              };
            }

            return (current as DriverNotification[]).map(
              (notification: DriverNotification) =>
                notification.id === realtimeData.payload.id
                  ? {
                      ...notification,
                      readAt:
                        notification.readAt ||
                        new Date(realtimeData.timestamp).toISOString(),
                    }
                  : notification,
            );
          },
        );
        return;
      }

      queryClient.setQueriesData<NotificationsData | InfiniteNotificationsData>(
        { queryKey: DRIVER_NOTIFICATIONS_QUERY_KEY },
        (
          current: NotificationsData | InfiniteNotificationsData | undefined,
        ) => {
          if (!current) {
            return current;
          }

          if ("pages" in current) {
            return {
              ...current,
              pages: current.pages.map((page: NotificationsPage) => ({
                ...page,
                notifications: page.notifications.map(
                  (notification: DriverNotification) => ({
                    ...notification,
                    readAt:
                      notification.readAt ||
                      new Date(realtimeData.timestamp).toISOString(),
                  }),
                ),
              })),
            };
          }

          return (current as DriverNotification[]).map(
            (notification: DriverNotification) => ({
              ...notification,
              readAt:
                notification.readAt ||
                new Date(realtimeData.timestamp).toISOString(),
            }),
          );
        },
      );
    },
  });

  useEffect(() => {
    if (status !== "error") {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: DRIVER_NOTIFICATIONS_QUERY_KEY,
    });
  }, [queryClient, status]);
}
