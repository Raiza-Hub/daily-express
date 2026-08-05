"use client";

import { BellIcon, SpinnerIcon } from "@phosphor-icons/react";
import {
  useDriverNotificationsInfinite,
  useGetDriver,
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
import { useCallback, useRef, useState } from "react";
import { formatRelativeTime, getToneClasses } from "~/lib/utils";

const NotificationInbox = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: driver, isLoading: isLoadingDriver } = useGetDriver();
  const notificationsEnabled = Boolean(driver?.id);
  const isVerificationPending =
    driver?.bankVerificationStatus === "pending" ||
    driver?.kycStatus === "pending";
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
    enabled: notificationsEnabled,
    refetchInterval: isVerificationPending ? 500 : false,
  });

  const notifications = data?.pages.flatMap((page) => page.notifications) ?? [];

  useBodyScrollLock(open);

  const unreadCount = data?.pages[0]?.unreadCount ?? 0;

  const markReadMutation = useMarkDriverNotificationRead();

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
    if (isOpen) {
      void refetch();
    }
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const fetchNextPageRef = useRef(fetchNextPage);
  fetchNextPageRef.current = fetchNextPage;

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry?.isIntersecting) return;
          fetchNextPageRef.current();
        },
        {
          root: scrollContainerRef.current,
          rootMargin: "200px",
          threshold: 0,
        },
      );
      observerRef.current.observe(node);
    },
    [],
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex cursor-pointer items-center justify-center rounded-full p-2 hover:bg-muted"
          aria-label="Open notifications"
        >
          <BellIcon className="h-6 w-6" aria-hidden="true" />
          {unreadCount > 0 && (
            <Badge
              variant="default"
              className="absolute -top-1 -right-1 h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none text-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-screen p-0 sm:w-[420px]" align="end">
        <div className="border-b px-4 py-2">
          <div className="flex items-center justify-between">
              <div className="text-lg font-medium text-foreground">
                Notifications
            </div>
          </div>
        </div>

        <div ref={scrollContainerRef} className="max-h-[28rem] overflow-y-auto">
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
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              You are caught up. New driver activity will show here.
            </div>
          ) : (
            <>
              {notifications.map((notification) => {
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

                    <div className="min-w-0 flex-1 cursor-pointer">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={notification?.href || ""}
                          className={cn(
                            "text-sm",
                            unread
                              ? "font-semibold text-foreground"
                              : "text-foreground/80",
                          )}
                        >
                          {notification.title}
                        </Link>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(notification.updatedAt)}
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

              {hasNextPage && !isFetchingNextPage && (
                <div ref={sentinelRef} className="h-px" />
              )}
              {isFetchingNextPage && (
                <div className="flex items-center justify-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                  <SpinnerIcon className="h-4 w-4 animate-spin" />
                  Loading more...
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationInbox;
