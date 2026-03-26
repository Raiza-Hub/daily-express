"use client";

import { QueryProvider } from "@repo/api";
import { Toaster } from "@repo/ui/components/sonner";
import { AuthProvider } from "./AuthProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </QueryProvider>
  );
}