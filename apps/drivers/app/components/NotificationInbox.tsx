"use client";

import { BellIcon, SpinnerIcon } from "@phosphor-icons/react";
import {
  useDriverNotificationsInfinite,
  useGetDriver,
  useMarkAllDriverNotificationsRead,
  useMarkDriverNotificationRead,
} from "@repo/api";
import { Badge } from "@repo/ui/components/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import { useBodyScrollLock } from "@repo/ui/hooks/use-body-scroll-lock";
import { cn } from "@repo/ui/lib/utils";
import type { DriverNotification } from "@shared/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NotificationTab } from "~/lib/type";
import { formatRelativeTime, getToneClasses } from "~/lib/utils";
import { usePushSubscription } from "~/hooks/usePushSubscription";
import { useDriverNotificationsRealtime } from "~/hooks/useDriverNotificationsRealtime";

const NotificationInbox = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>("all");
  const { data: driver, isLoading: isLoadingDriver } = useGetDriver();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useDriverNotificationsInfinite({
    limit: 20,
    enabled: Boolean(driver?.id),
  });

  const notifications = data?.pages.flatMap((page) => page.notifications) ?? [];

  useDriverNotificationsRealtime();

  useBodyScrollLock(open);

  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const filteredNotifications =
    tab === "unread"
      ? notifications.filter((item) => !item.readAt)
      : notifications;

  const markReadMutation = useMarkDriverNotificationRead();
  const markAllReadMutation = useMarkAllDriverNotificationsRead();
  const push = usePushSubscription();

  const handleNotificationClick = (notification: DriverNotification) => {
    if (!notification.readAt) {
      markReadMutation.mutate(notification.id);
    }

    setOpen(false);

    if (notification.href) {
      router.push(notification.href);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  const handleLoadMore = () => {
    fetchNextPage();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex cursor-pointer items-center justify-center rounded-full p-2 hover:bg-muted"
          aria-label="Open notifications"
        >
          <BellIcon className="h-6 w-6" aria-hidden="true" />
          {unreadCount > 0 && (
            <Badge
              variant="default"
              className="bg-red-600 h-4 w-4 absolute -top-[-4px] -right-[-4px] text-xs px-1.5 py-0"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-screen p-0 sm:w-[420px]" align="end">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-foreground">
                Notifications
              </div>
              <div className="text-sm text-muted-foreground">
                Driver updates from payouts, routes, and account status
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("all")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                  tab === "all"
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTab("unread")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                  tab === "unread"
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                Unread
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllReadMutation.mutate()}
                  className="text-xs font-medium text-foreground/80 transition-colors hover:text-foreground cursor-pointer"
                  disabled={markAllReadMutation.isPending}
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-h-[28rem] overflow-y-auto">
          {push.isSupported &&
            !push.isSubscribed &&
            typeof Notification !== "undefined" &&
            Notification.permission === "default" && (
              <div className="border-b bg-muted/30 px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                    <BellIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      Don&apos;t miss a trip or payout
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                      Get real-time updates on new trips, earnings, and
                      important account activity.
                    </p>
                    <button
                      type="button"
                      onClick={() => push.subscribe()}
                      className="mt-3 text-xs font-bold text-primary hover:underline cursor-pointer"
                    >
                      Turn on notifications
                    </button>
                  </div>
                </div>
              </div>
            )}

          {isLoadingDriver || isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <SpinnerIcon className="h-4 w-4 animate-spin" />
              Loading notifications...
            </div>
          ) : isError ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Notifications could not be loaded
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error instanceof Error
                  ? error.message
                  : "Try again in a moment."}
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-4 rounded-full border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {tab === "unread"
                ? "No unread notifications."
                : "You are caught up. New driver activity will show here."}
            </div>
          ) : (
            <>
              {filteredNotifications.map((notification) => {
                const toneClasses = getToneClasses(notification.tone);
                const unread = !notification.readAt;

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <span
                      className={cn(
                        "mt-1.5 inline-block h-1.5 w-1.5 rounded-full",
                        unread ? toneClasses.dot : "bg-slate-300",
                      )}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={notification?.href || ""}
                          className={cn(
                            "text-sm underline-offset-2 hover:underline cursor-pointer",
                            unread
                              ? "font-semibold text-foreground"
                              : "text-foreground/80",
                          )}
                        >
                          {notification.title}
                        </Link>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(notification.occurredAt)}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {notification.message}
                      </p>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            toneClasses.pill,
                          )}
                        >
                          {notification.tag}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}

              <div className="px-4 py-3">
                {hasNextPage ? (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isFetchingNextPage}
                    className="w-full rounded-full border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent cursor-pointer disabled:opacity-50"
                  >
                    {isFetchingNextPage ? (
                      <span className="flex items-center justify-center gap-2">
                        <SpinnerIcon className="h-4 w-4 animate-spin" />
                        Loading more...
                      </span>
                    ) : (
                      "Load more"
                    )}
                  </button>
                ) : (
                  <div className="text-center text-sm text-muted-foreground">
                    No more notifications
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationInbox;
