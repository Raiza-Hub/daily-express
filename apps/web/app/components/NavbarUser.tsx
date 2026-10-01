"use client";

import Link from "next/link";
import { useGetMe } from "@repo/api";
import { getInitials } from "~/components/user/settings-shared";

export function NavbarUser() {
    const { data: user, isPending, isError } = useGetMe();

    if (isPending) {
        return (
            <div className="flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-2">
                <span className="h-6 w-6 animate-pulse rounded-full bg-neutral-200" />
                <span className="h-3 w-24 animate-pulse rounded bg-neutral-200" />
            </div>
        );
    }

    if (isError || !user) {
        return null;
    }

    const name =
        `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;

    return (
        <Link
            href="/settings/profile"
            className="flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                {getInitials(name)}
            </span>
            <span className="max-w-32 truncate">{name}</span>
        </Link>
    );
}