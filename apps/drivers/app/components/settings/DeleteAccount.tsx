"use client"

import { CircleNotchIcon, TrashIcon } from "@phosphor-icons/react"
import { Button } from "@repo/ui/components/button"
import { useRouter } from "next/navigation"
import { useState } from "react"

// import { useMutation } from "@tanstack/react-query"
// import { CustomToast } from "@/components/custom-toast"

const DeleteAccount = () => {
    const router = useRouter()
    const isPending = null

    // const { mutate: deleteAccount, isPending } = useMutation({
    //     mutationFn: async () => {
    //         const res = await fetch("/api/auth/delete-user", {
    //             method: "PUT",
    //             headers: { "Content-Type": "application/json" },
    //             credentials: "include",
    //         });
    //
    //         if (!res.ok) {
    //             const errData = await res.json();
    //             CustomToast({ variant: "error", message: `${errData.message}` })
    //         }
    //
    //         const data = await res.json();
    //         return data;
    //     },
    //     onSuccess: () => { router.replace("/sign-in") },
    // });

    return (
        <div className="mt-10 pt-6 border-t border-red-100">
            <div className="mb-6 py-4 border-b border-gray-100">
                <h2 className="text-xl font-semibold mb-1 text-red-600">Delete Account</h2>
                <p className="text-sm text-muted-foreground">
                    Once you delete your account, there is no going back. All your data will be permanently removed from the platform.
                </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-sm font-medium">Permanently delete my account</p>
                    <p className="text-xs text-muted-foreground mt-0.5">This action is irreversible. Please be certain before proceeding.</p>
                </div>
                <Button
                    type="button"
                    variant="destructive"
                    className="cursor-pointer"
                // disabled={isPending}
                // onClick={() => deleteAccount()}
                >
                    {isPending ? (
                        <>
                            <CircleNotchIcon className="size-4 animate-spin" />
                            <span>Deleting account</span>
                        </>
                    ) : (
                        <>
                            <TrashIcon className="size-4" />
                            <span>Delete Account</span>
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

export default DeleteAccount;