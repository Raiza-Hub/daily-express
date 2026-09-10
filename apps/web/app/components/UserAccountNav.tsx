"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AddressBookIcon,
  SignOutIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { UserAccountNav as SharedUserAccountNav } from "@repo/ui/UserAccountNav";
import { useGetDriver, useLogout } from "@repo/api";
import type { User } from "@shared/types";
import { buildDriverAppUrl } from "~/lib/app-routing";
import { posthogEvents } from "~/lib/posthog-events";
import { usePostHog } from "posthog-js/react";

interface UserAccountNavProps {
  user: User | undefined;
}

export function UserAccountNav({ user }: UserAccountNavProps) {
  const router = useRouter();
  const { data: driver } = useGetDriver();
  const { mutate: signOut } = useLogout();
  const posthog = usePostHog();
  const driverLabel = driver ? "Driver dashboard" : "Become a driver";
  useEffect(() => {
    if (user?.id) {
      posthog.identify(user.id, {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      });
    }
  }, [user, posthog]);

  const handleDriverNavigation = () => {
    window.location.assign(buildDriverAppUrl("/"));
  };

  const handleSignOut = () => {
    signOut(undefined, {
      onSuccess: async () => {
        posthog.capture(posthogEvents.auth_logout_succeeded);
        posthog.reset();
        router.push("/sign-in");
      },
    });
  };

  const userData = {
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    profilePictureUrl: user?.profilePictureUrl ?? undefined,
  };

  return (
    <SharedUserAccountNav
      user={userData}
      menuItems={[
        {
          key: "profile",
          icon: <UserIcon />,
          label: "Profile",
          onClick: () => router.push("/settings/profile"),
        },
        {
          key: "Become a driver",
          icon: <AddressBookIcon />,
          label: driverLabel,
          onClick: handleDriverNavigation,
        },
      ]}
      footerItems={[
        {
          key: "signout",
          icon: <SignOutIcon />,
          label: "Log out",
          onClick: handleSignOut,
        },
      ]}
    />
  );
}
