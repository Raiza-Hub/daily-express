"use client";

import { useGetMe } from "@repo/api";

interface Props {
  children: React.ReactNode;
}

export function AuthProvider({ children }: Props) {
  useGetMe();

  return <>{children}</>;
}