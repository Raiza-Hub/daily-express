"use client";

import { QueryProvider, fetchCsrfToken } from "@repo/api";
import { Toaster } from "@repo/ui/components/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { PostHogProvider } from "./PostHogProviders";
import { useEffect } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    fetchCsrfToken();
  }, []);

  return (
    <NuqsAdapter>
      <QueryProvider>
        <PostHogProvider>{children}</PostHogProvider>
        <Toaster />
      </QueryProvider>
    </NuqsAdapter>
  );
}
