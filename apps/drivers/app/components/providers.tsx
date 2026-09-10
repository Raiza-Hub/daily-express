"use client";

import { QueryProvider } from "@repo/api";
import { Toaster } from "@repo/ui/components/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { PostHogProvider } from "./PostHogProviders";
import RequireDriverProfile from "./RequireDriverProfile";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <QueryProvider>
        <RequireDriverProfile />
        <PostHogProvider>{children}</PostHogProvider>
        <Toaster />
      </QueryProvider>
    </NuqsAdapter>
  );
}
