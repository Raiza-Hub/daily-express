"use client";

import { RealtimeProvider } from "@upstash/realtime/client";
import { QueryProvider } from "@repo/api";
import { Toaster } from "@repo/ui/components/sonner";
import { PostHogProvider } from "./PostHogProviders";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <RealtimeProvider
        api={{ url: "/api/realtime", withCredentials: true }}
        maxReconnectAttempts={5}
      >
        <PostHogProvider>{children}</PostHogProvider>
      </RealtimeProvider>
      <Toaster />
    </QueryProvider>
  );
}
