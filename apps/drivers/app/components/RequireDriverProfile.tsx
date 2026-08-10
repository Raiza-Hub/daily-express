"use client";

import { useGetDriver } from "@repo/api";
import { useRouter, usePathname } from "next/navigation";

import { env } from "~/env";

const PUBLIC_PATHS = ["/sign-up"];

export default function RequireDriverProfile() {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, isError } = useGetDriver();

  if (isLoading) return null;
  if (PUBLIC_PATHS.includes(pathname ?? "")) return null;

  if (isError) {
    const signInUrl = new URL("/sign-in", env.NEXT_PUBLIC_WEB_APP_URL);
    signInUrl.searchParams.set("redirect", "/");
    router.replace(signInUrl.toString());
    return null;
  }

  if (!data) {
    router.replace("/sign-up");
    return null;
  }

  return null;
}