"use client"

import { CircleNotchIcon, TrashIcon } from "@phosphor-icons/react"
import { Button } from "@repo/ui/components/button"
// import { CustomToast } from "@/components/custom-toast"
// import { Button } from "@/components/ui/button"
// import { IconLoader2 } from "@tabler/icons-react"
// import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"


const DeleteAccount = () => {
    const [inputValue, setInputValue] = useState<string>("")
    const router = useRouter()
    const isPending = null

    // const { mutate: deleteAccount, isPending } = useMutation({
    //     mutationFn: async () => {
    //         const res = await fetch("/api/auth/delete-user", {
    //             method: "PUT",
    //             headers: { "Content-Type": "application/json" },
    //             credentials: "include",
    //         });

    //         if (!res.ok) {
    //             const errData = await res.json();
    //             CustomToast({
    //                 variant: "error",
    //                 message: `${errData.message}`
    //             })
    //         }

    //         const data = await res.json();
    //         return data;
    //     },

    //     onSuccess: () => {
    //         router.replace("/sign-in")

    //     },
    // });

    return (
        <div className="">
            <div className="w-full flex flex-col mb-4 pb-2">
                <h2 className="text-lg text-red-600 font-semibold mb-1">Delete account</h2>
                <p className="text-sm">
                    Once you delete your account, there is no going back. Please be certain.
                </p>
            </div>

            <div>
                <Button
                    type="button"
                    variant="outline"
                    className="flex-1 hover:bg-red-500 text-red-500/80 hover:text-white cursor-pointer"
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
                                <span>Delete account</span>
                            </>
                    )}
                </Button>
            </div>
        </div>
    );
}

export default DeleteAccount;