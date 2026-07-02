"use client";

import { useQueryClient } from "@repo/api";
import { useCallback, useEffect, useRef, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_DAILYEXPRESS_API_URL || "http://localhost:8000";
const SSE_URL = `${API_URL}/api/v1/route/trips/live`;

export type StreamStatus = "connecting" | "connected" | "disconnected";

export function useStreamLiveTrips() {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const [status, setStatus] = useState<StreamStatus>("disconnected");

  const connect = useCallback(() => {
    if (typeof EventSource === "undefined") return;
    if (esRef.current) return;

    const es = new EventSource(SSE_URL, { withCredentials: true });
    esRef.current = es;
    setStatus("connecting");

    es.onopen = () => {
      setStatus("connected");
      void queryClient.invalidateQueries({ queryKey: ["availableTrips"] });
    };

    es.addEventListener("trip_claimed", () => {
      void queryClient.invalidateQueries({ queryKey: ["availableTrips"] });
    });

    es.addEventListener("trip_update", () => {
      void queryClient.invalidateQueries({ queryKey: ["availableTrips"] });
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        esRef.current = null;
        setStatus("disconnected");
      }
    };
  }, [queryClient]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);

  return status;
}
