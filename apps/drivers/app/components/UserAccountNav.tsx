"use client";

import { useEffect } from "react";
import {
  SignOutIcon,
  CircleNotchIcon,
  CarIcon,
  UserIcon,
  AddressBookIcon,
  BankIcon,
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
      mobileItems={[
        {
          key: "vehicles",
          icon: <CarIcon />,
          label: "Vehicles",
          onClick: () => router.push("/vehicles"),
        },
        {
          key: "settings-profile",
          icon: <UserIcon />,
          label: "Profile",
          onClick: () => router.push("/settings/profile"),
        },
        {
          key: "settings-accounts",
          icon: <AddressBookIcon />,
          label: "Accounts",
          onClick: () => router.push("/settings/accounts"),
        },
        {
          key: "settings-bank-details",
          icon: <BankIcon />,
          label: "Bank Details",
          onClick: () => router.push("/settings/bank-details"),
        },
      ]}
      footerItems={[
        {
          key: "signout",
          icon: <SignOutIcon />,
          label: "Log out",
          onClick: signOut,
        },
      ]}
    />
  );
}
