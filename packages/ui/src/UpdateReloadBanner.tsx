"use client";

import { useEffect, useState } from "react";
import { RefreshCwIcon, XIcon, ZapIcon } from "lucide-react";

import { Button } from "./components/button";
import { cn } from "./lib/utils";

const DISMISSED_PREFIX = "dailyexpress-update-banner-dismissed-";
const CHANNEL_NAME = "dailyexpress-deployment-version";

type UpdateReloadBannerProps = {
  initialVersion: string;
  appName?: "web" | "driver";
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

    let registration: ServiceWorkerRegistration | null = null;
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

    function handleVersionMessage(event: MessageEvent) {
      if (event.data?.type === "VERSION") {
        handleNewVersion(event.data.version);
        channel?.postMessage({
          type: "NEW_VERSION",
          version: event.data.version,
        });
      }
    }

    async function checkForUpdates() {
      if (registration) {
        try {
          await registration.update();
        } catch {
          // Registration update failed; next interval retries.
        }
      }
    }

    async function registerSW() {
      if (!("serviceWorker" in navigator)) {
        return;
      }

      try {
        const reg = await navigator.serviceWorker.register("/api/sw");
        registration = reg;

        navigator.serviceWorker.addEventListener(
          "message",
          handleVersionMessage,
        );

        if (reg.waiting) {
          reg.waiting.postMessage({ type: "GET_VERSION" });
          return;
        }

        reg.onupdatefound = () => {
          const installing = reg.installing;
          if (!installing) return;

          installing.onstatechange = () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              installing.postMessage({ type: "GET_VERSION" });
            }
          };
        };
      } catch {
        // ServiceWorker not supported or registration failed.
      }
    }

    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent) => {
        if (event.data?.type === "NEW_VERSION") {
          handleNewVersion(event.data.version);
        }
      };
    }

    void registerSW();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkForUpdates();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopped = true;
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      if (navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener(
          "message",
          handleVersionMessage,
        );
      }

      channel?.close();
    };
  }, [initialVersion, isDevelopment]);

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
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "border-b border-[#BFDBFE]",
        "flex items-center justify-between gap-3 px-4 py-2.5",
        "bg-[#F8FBFF] text-sm font-medium text-[#1E40AF]",
        "animate-in slide-in-from-top duration-300 ease-out",
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
            "focus-visible:ring-[#1E40AF]",
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
            "focus-visible:ring-[#1E40AF]",
          )}
          onClick={handleDismiss}
          aria-label="Dismiss update notification"
        >
          <XIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </span>
    </div>
  );
}
