"use client";

import { useDriverNotificationsRealtime } from "~/hooks/useDriverNotificationsRealtime";

export function DriverRealtimeSync() {
  useDriverNotificationsRealtime();
  return null;
}
