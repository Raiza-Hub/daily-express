"use client";

import { UpdateReloadBanner } from "@repo/ui/UpdateReloadBanner";
import { usePathname } from "next/navigation";

type AppUpdateReloadBannerProps = {
  initialVersion: string;
};

export function AppUpdateReloadBanner({
  initialVersion,
}: AppUpdateReloadBannerProps) {
  const pathname = usePathname();

  return (
    <UpdateReloadBanner
      initialVersion={initialVersion}
      appName="driver"
      updateCheckKey={pathname}
    />
  );
}
