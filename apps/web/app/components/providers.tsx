"use client";

import { QueryProvider } from "@repo/api";
import { Toaster } from "@repo/ui/components/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { PostHogProvider } from "./PostHogProviders";
import Banner from "./Banner";

export default function Providers({ children }: { children: React.ReactNode }) {
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
