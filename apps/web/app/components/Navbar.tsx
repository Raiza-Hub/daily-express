"use client";

import Link from "next/link";
import { buttonVariants } from "@repo/ui/components/button";
import {
  CircleNotchIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { UserAccountNav } from "./UserAccountNav";
import Image from "next/image";
import { useGetMe } from "@repo/api";
import { buildAuthHref, buildDriverSignUpUrl } from "~/lib/app-routing";

const Navbar = () => {
  const { data: user, isLoading } = useGetMe();
  const isGuest = !isLoading && !user;

  return (
    <div className="bg-white sticky z-60 top-0 inset-x-0 h-16">
      <header className="relative bg-gray-50">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 ">
          <div className="flex h-16 items-center">
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={520}
                  height={530}
                  className="object-contain object-center"
                  style={{ width: "28px", height: "auto" }}
                />
                <h1 className="text-xl font-semibold leading-none">Daily Express</h1>
              </Link>
            </div>

            <div className="ml-auto flex items-center">
              <div className="lg:flex lg:flex-1 lg:items-center lg:justify-end lg:space-x-6">
                {isGuest ? (
                  <div className="hidden lg:block">
                    <Link
                      href={buildAuthHref("/sign-up", buildDriverSignUpUrl())}
                      className={buttonVariants({
                        variant: "ghost",
                      })}
                    >
                      Become a driver
                    </Link>
                  </div>
                ) : null}

                {isGuest ? (
                  <span
                    className="hidden lg:block h-6 w-px bg-gray-200"
                    aria-hidden="true"
                  />
                ) : null}

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
