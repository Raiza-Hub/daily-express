"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RefreshCwIcon, XIcon, ZapIcon } from "lucide-react";

import { Button } from "./components/button";
import { cn } from "./lib/utils";

const DISMISSED_PREFIX = "dailyexpress-update-banner-dismissed-";
const BASE_INTERVAL_MS = 60_000;
const MAX_INTERVAL_MS = 300_000;
const CHANNEL_NAME = "dailyexpress-deployment-version";

type UpdateReloadBannerProps = {
  initialVersion: string;
  appName?: "web" | "driver";
};

type VersionResponse = {
  version?: string;
};

function isVersionDismissed(version: string) {
  try {
    return sessionStorage.getItem(`${DISMISSED_PREFIX}${version}`) === "1";
  } catch {
    return false;
  }
}

function saveDismissedVersion(version: string) {
  try {
    sessionStorage.setItem(`${DISMISSED_PREFIX}${version}`, "1");
  } catch {
    // Some browsers block storage in private or restricted contexts.
  }
}

export function UpdateReloadBanner({
  initialVersion,
  appName = "web",
}: UpdateReloadBannerProps) {
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const [bannerHeight, setBannerHeight] = useState(0);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const isDevelopment = initialVersion === "development";

  const updateAvailable =
    !isDevelopment &&
    latestVersion !== null &&
    latestVersion !== initialVersion &&
    dismissedVersion !== latestVersion;

  useEffect(() => {
    if (isDevelopment) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    let intervalMs = BASE_INTERVAL_MS;
    let channel: BroadcastChannel | null = null;
    let stopped = false;

    function handleNewVersion(version: unknown) {
      if (
        typeof version !== "string" ||
        !version ||
        version === "development" ||
        version === initialVersion
      ) {
        return;
      }

      setLatestVersion(version);

      if (isVersionDismissed(version)) {
        setDismissedVersion(version);
      }
    }

    async function fetchVersion() {
      try {
        const response = await fetch(`/api/version?ts=${Date.now()}`, {
          cache: "no-store",
          credentials: "omit",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch app version: ${response.status}`);
        }

        const data = (await response.json()) as VersionResponse;
        const version = data.version;

        if (version && version !== initialVersion) {
          handleNewVersion(version);
          channel?.postMessage({
            type: "NEW_VERSION",
            version,
          });
        }

        intervalMs = BASE_INTERVAL_MS;
      } catch {
        intervalMs = Math.min(intervalMs * 2, MAX_INTERVAL_MS);
      }
    }

    function scheduleNextCheck() {
      if (stopped) {
        return;
      }

      timer = setTimeout(() => {
        void fetchVersion().finally(scheduleNextCheck);
      }, intervalMs);
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") {
        return;
      }

      intervalMs = BASE_INTERVAL_MS;

      if (timer) {
        clearTimeout(timer);
      }

      void fetchVersion().finally(scheduleNextCheck);
    }

    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent) => {
        if (event.data?.type === "NEW_VERSION") {
          handleNewVersion(event.data.version);
        }
      };
    }

    void fetchVersion().finally(scheduleNextCheck);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (timer) {
        clearTimeout(timer);
      }

      channel?.close();
    };
  }, [initialVersion, isDevelopment]);

  useLayoutEffect(() => {
    if (!updateAvailable) {
      return;
    }

    const root = document.documentElement;

    function syncBannerHeight() {
      const nextHeight = bannerRef.current?.offsetHeight ?? 0;
      setBannerHeight(nextHeight);
      root.style.setProperty(
        "--dailyexpress-update-banner-height",
        `${nextHeight}px`
      );
      root.dataset.dailyexpressUpdateBanner = "visible";
    }

    syncBannerHeight();

    const observer =
      typeof ResizeObserver !== "undefined" && bannerRef.current
        ? new ResizeObserver(syncBannerHeight)
        : null;

    if (bannerRef.current) {
      observer?.observe(bannerRef.current);
    }

    window.addEventListener("resize", syncBannerHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncBannerHeight);
      root.style.removeProperty("--dailyexpress-update-banner-height");
      delete root.dataset.dailyexpressUpdateBanner;
      setBannerHeight(0);
    };
  }, [updateAvailable]);

  function handleDismiss() {
    if (!latestVersion) {
      return;
    }

    setDismissedVersion(latestVersion);
    saveDismissedVersion(latestVersion);
  }

  function handleReload() {
    window.location.reload();
  }

  if (!updateAvailable) {
    return null;
  }

  const label =
    appName === "driver"
      ? "A new version of the driver app is available."
      : "A new version of Daily Express is available.";

  return (
    <>
      <div
        ref={bannerRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "fixed inset-x-0 top-0 z-9999 border-b border-[#BFDBFE]",
          "flex items-center justify-between gap-3 px-4 py-2.5",
          "bg-[#F8FBFF] text-sm font-medium text-[#1E40AF]",
          "animate-in slide-in-from-top duration-300 ease-out"
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ZapIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="leading-snug">
            {label}{" "}
            <span className="hidden sm:inline">
              Reload to get the latest updates.
            </span>
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 cursor-pointer gap-1.5 rounded-sm px-2.5",
              "bg-[#EFF6FF] text-[#1E40AF] hover:bg-[#DBEAFE] hover:text-[#1E40AF]",
              "focus-visible:ring-[#1E40AF]"
            )}
            onClick={handleReload}
          >
            <RefreshCwIcon className="size-3.5" aria-hidden="true" />
            Reload
          </Button>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "size-7 cursor-pointer rounded-sm",
              "text-[#1E40AF] hover:bg-[#DBEAFE] hover:text-[#1E40AF]",
              "focus-visible:ring-[#1E40AF]"
            )}
            onClick={handleDismiss}
            aria-label="Dismiss update notification"
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </span>
      </div>
      <div aria-hidden="true" style={{ height: bannerHeight }} />
    </>
  );
}
