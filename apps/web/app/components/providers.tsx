"use client";

import { QueryProvider } from "@repo/api";
import { Toaster } from "@repo/ui/components/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <QueryProvider>
        {children}
        <Toaster />
      </QueryProvider>
    </NuqsAdapter>
  );
}
