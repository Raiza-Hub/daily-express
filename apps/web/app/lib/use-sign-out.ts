"use client";

import { useRouter } from "next/navigation";
import { useLogout } from "@repo/api";

export function useSignOut(options?: { onSuccess?: () => void }) {
    const router = useRouter();
    const logout = useLogout();

    return {
        ...logout,
        signOut: () =>
            logout.mutate(undefined, {
                onSuccess: () => {
                    options?.onSuccess?.();
                    router.replace("/");
                    router.refresh();
                },
            }),
    };
}
