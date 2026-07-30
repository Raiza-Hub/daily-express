"use client";

import { useEffect } from "react";
import {
  QuestionIcon,
  SignOutIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { UserAccountNav as SharedUserAccountNav } from "@repo/ui/UserAccountNav";
import { useGetDriver, useLogout } from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { env } from "~/env";
import { posthogEvents } from "~/lib/posthog-events";
import { usePostHog } from "posthog-js/react";
import { useRouter } from "next/navigation";

export function UserAccountNav() {
  const { data: driver, isLoading } = useGetDriver();
  const { mutate: logout } = useLogout();
  const posthog = usePostHog();
  const router = useRouter();

  useEffect(() => {
    if (driver?.id) {
      posthog.identify(driver.id, {
        email: driver.email,
        name: `${driver.firstName} ${driver.lastName}`,
      });
    }

    if (!isLoading && !driver) {
      router.replace("/sign-up");
    }
  }, [driver, isLoading, router, posthog]);

  const signOut = () => {
    logout(undefined, {
      onSuccess: () => {
        posthog.capture(posthogEvents.driver_logout_succeeded);
        posthog.reset();
        window.location.href = `${env.NEXT_PUBLIC_WEB_APP_URL}/sign-in`;
      },
    });
  };

  if (isLoading && !driver) {
    return (
      <Avatar className="h-10 w-10">
        <AvatarFallback>
          <CircleNotchIcon className="h-5 w-5 animate-spin text-muted-foreground" />
        </AvatarFallback>
      </Avatar>
    );
  }

  if (!driver) {
    return null;
  }

  const user = {
    firstName: driver.firstName,
    lastName: driver.lastName,
    email: driver.email,
    profilePictureUrl: driver.profile_pic || undefined,
  };

  return (
    <SharedUserAccountNav
      user={user}
      menuItems={[
        {
          key: "support",
          icon: <QuestionIcon weight="bold" />,
          label: "Support",
          href: "mailto:support@yourdomain.com",
        },
      ]}
      footerItems={[
        {
          key: "signout",
          icon: <SignOutIcon weight="bold" />,
          label: "Log out",
          onClick: signOut,
        },
      ]}
    />
  );
}
