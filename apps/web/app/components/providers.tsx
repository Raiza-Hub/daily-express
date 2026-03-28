"use client";

import { QueryProvider } from "@repo/api";
import { Toaster } from "@repo/ui/components/sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <Toaster />
    </QueryProvider>
  );
}