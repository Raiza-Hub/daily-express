"use client";

import { createRealtime } from "@upstash/realtime/client";
import type { DriverNotificationRealtimeSchema } from "~/lib/realtime-shared";

type UseRealtime = ReturnType<
  typeof createRealtime<DriverNotificationRealtimeSchema>
>["useRealtime"];

export const useRealtime: UseRealtime =
  createRealtime<DriverNotificationRealtimeSchema>().useRealtime;
