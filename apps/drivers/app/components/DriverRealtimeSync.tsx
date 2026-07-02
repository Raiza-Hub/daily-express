"use client";

import { useDriverNotificationsSSE } from "~/hooks/useDriverNotificationsSSE";

export function DriverRealtimeSync() {
  useDriverNotificationsSSE();
  return null;
}
