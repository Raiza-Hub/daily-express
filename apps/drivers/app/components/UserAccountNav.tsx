"use client";

import { useRouter } from "next/navigation";
import {
  QuestionIcon,
  SignOutIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import { UserAccountNav as SharedUserAccountNav } from "@repo/ui/UserAccountNav";
import { useGetDriver, useLogout } from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";

export function UserAccountNav() {
  const router = useRouter();
  const { data: driver, isLoading } = useGetDriver();
  const { mutate: logout } = useLogout();

  const signOut = () => {
    logout(undefined, {
      onSuccess: () => {
        router.push("/sign-in");
      },
    });
  };

  if (isLoading) {
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
