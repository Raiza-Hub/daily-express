"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  useGetDriver,
  useSubscribeToPush,
  useUnsubscribeFromPush,
  useVapidPublicKey,
} from "@repo/api";
import { env } from "~/env";

const SERVICE_WORKER_PATH = "/push-worker.js";
const API_GATEWAY_URL = env.NEXT_PUBLIC_API_GATEWAY_URL;

function buildServiceWorkerUrl() {
  const serviceWorkerUrl = new URL(SERVICE_WORKER_PATH, window.location.origin);
  serviceWorkerUrl.searchParams.set("apiGatewayUrl", API_GATEWAY_URL);
  return serviceWorkerUrl.toString();
}

async function unregisterLegacyPushWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations
      .filter((registration) =>
        registration.active?.scriptURL.includes("/api/push-worker"),
      )
      .map((registration) => registration.unregister()),
  );
}

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

export function usePushSubscription() {
  const subscriptionRef = useRef<PushSubscription | null>(null);
  const syncRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    error: null,
  });

  const { data: driver, isLoading: isLoadingDriver } = useGetDriver();
  const { data: vapidPublicKey, isLoading: isLoadingVapidKey } =
    useVapidPublicKey();
  const subscribeMutation = useSubscribeToPush();
  const unsubscribeMutation = useUnsubscribeFromPush();

  const clearSyncRetry = () => {
    if (syncRetryTimeoutRef.current) {
      clearTimeout(syncRetryTimeoutRef.current);
      syncRetryTimeoutRef.current = null;
    }
  };

  const isDriverIdentityPendingError = (error: unknown) => {
    return (
      error instanceof Error &&
      error.message.toLowerCase().includes("driver identity not found")
    );
  };

  const buildSubscriptionData = (subscription: PushSubscription) => {
    const { keys } = subscription.toJSON();

    return {
      endpoint: subscription.endpoint,
      p256dh: keys?.p256dh || "",
      auth: keys?.auth || "",
    };
  };

  const scheduleSubscriptionSync = (subscription: PushSubscription) => {
    clearSyncRetry();
    syncRetryTimeoutRef.current = setTimeout(() => {
      void subscribeMutation
        .mutateAsync(buildSubscriptionData(subscription))
        .then(() => {
          clearSyncRetry();
          setState((prev) => ({ ...prev, error: null }));
        })
        .catch((error) => {
          if (isDriverIdentityPendingError(error)) {
            scheduleSubscriptionSync(subscription);
            return;
          }

          console.error("Failed to sync existing push subscription:", error);
          clearSyncRetry();
          setState((prev) => ({
            ...prev,
            error: "Failed to sync push subscription",
          }));
        });
    }, 5000);
  };

  const syncExistingSubscription = useEffectEvent(
    (existingSubscription: PushSubscription) => {
      void subscribeMutation
        .mutateAsync(buildSubscriptionData(existingSubscription))
        .catch((error) => {
          if (isDriverIdentityPendingError(error)) {
            scheduleSubscriptionSync(existingSubscription);
            return;
          }

          console.error("Failed to sync existing push subscription:", error);
          setState((prev) => ({
            ...prev,
            error: "Failed to sync push subscription",
          }));
        });
    },
  );

  useEffect(() => {
    const init = async () => {
      if (isLoadingDriver) {
        setState((prev) => ({ ...prev, isLoading: true }));
        return;
      }

      if (typeof window === "undefined") {
        setState((prev) => ({ ...prev, isSupported: false, isLoading: false }));
        return;
      }

      if (!("serviceWorker" in navigator)) {
        setState((prev) => ({
          ...prev,
          isSupported: false,
          isLoading: false,
          error: "Service workers not supported",
        }));
        return;
      }

      if (!("PushManager" in window)) {
        setState((prev) => ({
          ...prev,
          isSupported: false,
          isLoading: false,
          error: "Push notifications not supported",
        }));
        return;
      }

      if (!driver?.id) {
        clearSyncRetry();
        setState((prev) => ({
          ...prev,
          isSubscribed: false,
          isLoading: false,
          error: null,
        }));
        return;
      }

      setState((prev) => ({ ...prev, isSupported: true }));

      try {
        await unregisterLegacyPushWorkers();
        const registration = await navigator.serviceWorker.register(
          buildServiceWorkerUrl(),
          {
            scope: "/",
            updateViaCache: "none",
          },
        );

        const existingSubscription =
          await registration.pushManager.getSubscription();

        if (existingSubscription) {
          subscriptionRef.current = existingSubscription;
          syncExistingSubscription(existingSubscription);
          setState((prev) => ({
            ...prev,
            isSubscribed: true,
            isLoading: false,
            error: null,
          }));
        } else {
          clearSyncRetry();
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error("Service Worker registration failed:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to register service worker",
        }));
      }
    };

    init();
    return () => {
      clearSyncRetry();
    };
    // React 19 Effect Events intentionally stay out of dependency arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver?.id, isLoadingDriver]);

  const subscribe = async () => {
    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        error: "Push notifications not supported",
      }));
      return false;
    }

    if (!driver?.id || isLoadingDriver) {
      setState((prev) => ({
        ...prev,
        error: "Driver profile is still loading",
      }));
      return false;
    }

    if (!vapidPublicKey || isLoadingVapidKey) {
      setState((prev) => ({ ...prev, error: "VAPID key not loaded" }));
      return false;
    }

    let subscription: PushSubscription | null = null;

    try {
      const registration = await navigator.serviceWorker.ready;

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as BufferSource,
      });

      await subscribeMutation.mutateAsync(buildSubscriptionData(subscription));

      subscriptionRef.current = subscription;
      clearSyncRetry();

      setState((prev) => ({ ...prev, isSubscribed: true, error: null }));
      return true;
    } catch (error) {
      if (subscription && isDriverIdentityPendingError(error)) {
        subscriptionRef.current = subscription;
        scheduleSubscriptionSync(subscription);
        setState((prev) => ({
          ...prev,
          isSubscribed: true,
          error: null,
        }));
        return true;
      }

      console.error("Failed to subscribe to push:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to subscribe";
      let rollbackSucceeded = false;

      if (subscription) {
        try {
          await subscription.unsubscribe();
          rollbackSucceeded = true;
        } catch (unsubscribeError) {
          console.error(
            "Failed to roll back local push subscription:",
            unsubscribeError,
          );
        }
      }

      subscriptionRef.current = rollbackSucceeded ? null : subscription;
      setState((prev) => ({
        ...prev,
        isSubscribed: !rollbackSucceeded && Boolean(subscription),
        error: errorMessage,
      }));
      return false;
    }
  };

  const unsubscribe = async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      subscriptionRef.current ||
      (await registration.pushManager.getSubscription());
    if (!subscription) {
      setState((prev) => ({ ...prev, isSubscribed: false, error: null }));
      return true;
    }

    const endpoint = subscription.endpoint;
    const results = await Promise.allSettled([
      subscription.unsubscribe(),
      unsubscribeMutation.mutateAsync(endpoint),
    ]);

    const browserUnsubscribed = results[0].status === "fulfilled";
    const serverUnsubscribed = results[1].status === "fulfilled";
    const serverFailure =
      results[1].status === "rejected" ? results[1].reason : null;
    const identityMissingOnServer =
      !serverUnsubscribed && isDriverIdentityPendingError(serverFailure);

    if (browserUnsubscribed) {
      subscriptionRef.current = null;
      clearSyncRetry();
    } else {
      subscriptionRef.current = subscription;
    }

    if (!serverUnsubscribed && !identityMissingOnServer) {
      console.error(
        "Failed to remove push subscription from server:",
        serverFailure,
      );
    }

    setState((prev) => ({
      ...prev,
      isSubscribed: !browserUnsubscribed,
      error: serverUnsubscribed || identityMissingOnServer
        ? null
        : "Failed to remove push subscription from server",
    }));

    return browserUnsubscribed && (serverUnsubscribed || identityMissingOnServer);
  };

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
