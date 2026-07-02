"use client";

import { QueryProvider, fetchCsrfToken } from "@repo/api";
import { Toaster } from "@repo/ui/components/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { PostHogProvider } from "./PostHogProviders";
import Banner from "./Banner";
import { useEffect } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    fetchCsrfToken();
  }, []);

  return (
    <NuqsAdapter>
      <PostHogProvider>
        <QueryProvider>
          {children}
          <Banner />
          <Toaster />
        </QueryProvider>
      </PostHogProvider>
    </NuqsAdapter>
  );
}
