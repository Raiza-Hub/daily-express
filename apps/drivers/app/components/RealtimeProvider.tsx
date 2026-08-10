"use client";

import { useDriverNotificationsSSE } from "~/hooks/useDriverNotificationsSSE";
import { useStreamLiveTrips } from "~/hooks/useStreamLiveTrips";

export function RealtimeProvider() {
  useStreamLiveTrips();
  useDriverNotificationsSSE();
  return null;
}