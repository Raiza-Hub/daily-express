"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@repo/ui/components/button";

import {
  BellIcon,
  CaretDownIcon,
  MapPinPlusIcon,
  PlusIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Icons } from "./Icons";
import NavItem from "./NavItem";
import { UserAccountNav } from "./UserAccountNav";
import Image from "next/image";
import {
  useGetMe,
} from "@repo/api";

const Navbar = () => {
  const { data: user, isLoading } = useGetMe();

  return (
    <div className="bg-white sticky z-60 top-0 inset-x-0 h-16">
      <header className="relative bg-gray-50">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 ">
          <div className="flex h-16 items-center">
            <div className="flex">
              <Link href="/">
                <Image
                  src="/logo2.png"
                  alt="Logo"
                  width={40}
                  height={40}
                  className="object-contain object-center"
                />
              </Link>
            </div>

            <div className="ml-auto flex items-center">
              <div className="lg:flex lg:flex-1 lg:items-center lg:justify-end lg:space-x-6">
                {user ? null : (
                  <div className="hidden lg:block">
                    <Link
                      href="/sign-in"
                      className={buttonVariants({
                        variant: "ghost",
                      })}
                    >
                      Become a driver
                    </Link>
                  </div>
                )}

                {user ? null : (
                  <span
                    className="hidden lg:block h-6 w-px bg-gray-200"
                    aria-hidden="true"
                  />
                )}

                {user ? (
                  <UserAccountNav user={user} />
                ) : isLoading ? (
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      <CircleNotchIcon className="h-5 w-5 animate-spin text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Link
                    href="/sign-in"
                    className={buttonVariants({
                      variant: "submit",
                    })}
                  >
                    Sign in
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
};

export default Navbar;