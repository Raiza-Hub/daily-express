"use client";

import type { DriverNotification } from "@shared/types";
import { useGetDriver, useQueryClient } from "@repo/api";
import { useEffect, useRef } from "react";

const DAILYEXPRESS_API_URL =
  process.env.NEXT_PUBLIC_DAILYEXPRESS_API_URL || "http://localhost:8000";

const SSE_URL = `${DAILYEXPRESS_API_URL}/api/v1/notifications/stream`;

const DRIVER_NOTIFICATIONS_QUERY_KEY = ["driver-notifications"] as const;
const DRIVER_QUERY_KEY = ["driver"] as const;
const DRIVER_STATS_QUERY_KEY = ["driverStats"] as const;
const DRIVER_ROUTES_QUERY_KEY = ["driverRoutes"] as const;
const TRIPS_SUMMARY_RANGE_QUERY_KEY = ["tripsSummaryRange"] as const;

const DASHBOARD_AFFECTING_TYPES = new Set([
  "trip_claimed",
  "trip_completed",
  "trip_cancelled",
]);

const STATS_AFFECTING_TYPES = new Set([
  "payout_completed",
  "payout_failed",
  "payout_reconciliation_failed",
]);

const PROFILE_PICTURE_UPLOAD_SUCCEEDED_NOTIFICATION_TYPE =
  "profile_picture_upload_succeeded";

interface NotificationsPage {
  notifications: DriverNotification[];
  nextCursor: string | null;
}

interface SseEventEnvelope {
  version: number;
  type: string;
  payload: unknown;
  timestamp: number;
}

function parseSseEvent(raw: string): SseEventEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const obj = parsed as Record<string, unknown>;

    if (
      typeof obj.version !== "number" ||
      typeof obj.type !== "string" ||
      typeof obj.timestamp !== "number"
    ) {
      return null;
    }

    return {
      version: obj.version,
      type: obj.type,
      payload: obj.payload,
      timestamp: obj.timestamp,
    };
  } catch {
    return null;
  }
}

function isDriverNotification(
  value: unknown,
): value is DriverNotification {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.title === "string" &&
    typeof obj.type === "string"
  );
}

function isReadPayload(value: unknown): value is { id: string } {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.id === "string";
}

function getNotificationTime(value: Date | string | null | undefined) {
  if (!value) return 0;
  return new Date(value).getTime();
}

function sortNotifications(notifications: DriverNotification[]) {
  return [...notifications].sort((left, right) => {
    const occurredDiff =
      getNotificationTime(right.occurredAt) -
      getNotificationTime(left.occurredAt);
    if (occurredDiff !== 0) return occurredDiff;
    return (
      getNotificationTime(right.createdAt) -
      getNotificationTime(left.createdAt)
    );
  });
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

export function useDriverNotificationsSSE() {
  const queryClient = useQueryClient();
  const { data: driver } = useGetDriver();
  const isFirstOpen = useRef(true);

  useEffect(() => {
    if (!driver?.id) return;

    const es = new EventSource(SSE_URL, { withCredentials: true });

    es.addEventListener("open", () => {
      if (!isFirstOpen.current) {
        void queryClient.invalidateQueries({
          queryKey: DRIVER_NOTIFICATIONS_QUERY_KEY,
        });
      }
      isFirstOpen.current = false;
    });

    es.addEventListener("notification.created", (event: MessageEvent) => {
      const envelope = parseSseEvent(event.data);
      if (!envelope || envelope.type !== "notification.created") return;
      if (!isDriverNotification(envelope.payload)) return;

      const payload = envelope.payload;

      if (DASHBOARD_AFFECTING_TYPES.has(payload.type)) {
        void invalidateDriverDashboardQueries(queryClient);
      }

      if (STATS_AFFECTING_TYPES.has(payload.type)) {
        void queryClient.invalidateQueries({
          queryKey: DRIVER_STATS_QUERY_KEY,
          exact: true,
          refetchType: "active",
        });
      }

      if (payload.type === PROFILE_PICTURE_UPLOAD_SUCCEEDED_NOTIFICATION_TYPE) {
        void queryClient.invalidateQueries({
          queryKey: DRIVER_QUERY_KEY,
          exact: true,
          refetchType: "active",
        });
      }

      queryClient.setQueriesData(
        { queryKey: DRIVER_NOTIFICATIONS_QUERY_KEY },
        (current: unknown) => {
          if (!current) {
            return {
              pages: [
                { notifications: [payload], nextCursor: null },
              ],
              pageParams: [null] as (string | null)[],
            };
          }

          if (
            typeof current === "object" &&
            current !== null &&
            "pages" in current
          ) {
            const c = current as {
              pages: NotificationsPage[];
              pageParams: unknown[];
            };
            return {
              ...c,
              pages: c.pages.map(
                (page: NotificationsPage, pageIndex: number) => {
                  if (pageIndex === 0) {
                    return {
                      ...page,
                      notifications: sortNotifications([
                        payload,
                        ...page.notifications.filter(
                          (n: DriverNotification) => n.id !== payload.id,
                        ),
                      ]),
                    };
                  }
                  return page;
                },
              ),
            };
          }

          return sortNotifications([
            payload,
            ...(current as DriverNotification[]).filter(
              (n: DriverNotification) => n.id !== payload.id,
            ),
          ]);
        },
      );
    });

    es.addEventListener("notification.read", (event: MessageEvent) => {
      const envelope = parseSseEvent(event.data);
      if (!envelope || envelope.type !== "notification.read") return;
      if (!isReadPayload(envelope.payload)) return;

      const readId = envelope.payload.id;

      queryClient.setQueriesData(
        { queryKey: DRIVER_NOTIFICATIONS_QUERY_KEY },
        (current: unknown) => {
          if (!current) return current;

          const markRead = (n: DriverNotification) =>
            n.id === readId
              ? {
                  ...n,
                  readAt:
                    n.readAt ||
                    new Date(envelope.timestamp).toISOString(),
                }
              : n;

          if (
            typeof current === "object" &&
            current !== null &&
            "pages" in current
          ) {
            const c = current as { pages: NotificationsPage[] };
            return {
              ...c,
              pages: c.pages.map((page: NotificationsPage) => ({
                ...page,
                notifications: page.notifications.map(markRead),
              })),
            };
          }

          return (current as DriverNotification[]).map(markRead);
        },
      );
    });

    es.addEventListener("notification.read_all", (event: MessageEvent) => {
      const envelope = parseSseEvent(event.data);
      if (!envelope || envelope.type !== "notification.read_all") return;

      queryClient.setQueriesData(
        { queryKey: DRIVER_NOTIFICATIONS_QUERY_KEY },
        (current: unknown) => {
          if (!current) return current;

          const markAllRead = (n: DriverNotification) => ({
            ...n,
            readAt: n.readAt || new Date(envelope.timestamp).toISOString(),
          });

          if (
            typeof current === "object" &&
            current !== null &&
            "pages" in current
          ) {
            const c = current as { pages: NotificationsPage[] };
            return {
              ...c,
              pages: c.pages.map((page: NotificationsPage) => ({
                ...page,
                notifications: page.notifications.map(markAllRead),
              })),
            };
          }

          return (current as DriverNotification[]).map(markAllRead);
        },
      );
    });

    es.addEventListener("error", () => {
      void queryClient.invalidateQueries({
        queryKey: DRIVER_NOTIFICATIONS_QUERY_KEY,
      });
    });

    return () => {
      es.close();
      isFirstOpen.current = true;
    };
  }, [driver?.id, queryClient]);
}
