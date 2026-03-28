"use client";

import { useRouter } from "next/navigation";
import {
  IdentificationCardIcon,
  QuestionIcon,
  SignOutIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { UserAccountNav as SharedUserAccountNav } from "@repo/ui/UserAccountNav";
import { useLogout } from "@repo/api";
import type { User } from "@shared/types";

interface UserAccountNavProps {
  user: User | undefined;
}

export function UserAccountNav({ user }: UserAccountNavProps) {
  const router = useRouter();

  const { mutate: signOut } = useLogout();

  const handleSignOut = () => {
    signOut(undefined, {
      onSuccess: () => {
        router.push("/sign-in");
      },
    });
  };

  const userData = {
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    profilePictureUrl: undefined,
  };

  return (
    <SharedUserAccountNav
      user={userData}
      menuItems={[
        {
          key: "profile",
          icon: <UserIcon weight="bold" />,
          label: "Profile",
          onClick: () => router.push("/settings/profile"),
        },
        {
          key: "Become a driver",
          icon: <IdentificationCardIcon weight="bold" />,
          label: "Become a driver",
          onClick: () => router.push("/settings/profile"),
        },
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
          onClick: handleSignOut,
        },
      ]}
    />
  );
}
