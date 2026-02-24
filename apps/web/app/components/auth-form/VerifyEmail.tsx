"use client"


import { useRouter } from "next/navigation"
import { useState } from "react"
import z from "zod"
import { OtpSchema } from "@repo/types/authSchema"
import { Button } from "@repo/ui/components/button"
import { CircleNotchIcon, MailboxIcon } from "@phosphor-icons/react"
import { OTPInput } from "@repo/ui/OTPInput"
import ResendButton from "./ResendButton"

const VerifyEmailForm = () => {
    const router = useRouter();
    const [otp, setOtp] = useState<string>("")
    const [zoderr, setZoderr] = useState<string>("")

    const isPending = false
    const error = ""
    const email = "wisdomadbeola62@gmail.com"

    // const { mutate, isPending, error, reset } = useMutation({
    //     mutationFn: async (otp: string): Promise<OtpResponse> => {
    //         const res = await fetch("/api/auth/verify-email", {
    //             method: "PUT",
    //             headers: { "Content-Type": "application/json" },
    //             credentials: "include",
    //             body: JSON.stringify({ otp }),
    //         });

    //         const data: OtpResponse = await res.json();

    //         if (!res.ok) {
    //             throw new Error(data.message);
    //         }



    //         return data;
    //     },
    //     onSuccess: () => {
    //         router.push("/dashboard");
    //     },
    // });

    const handleVerify = (otp: string) => {
        try {
            OtpSchema.parse(otp)
            // mutate(otp)
        } catch (err) {
            // if (err instanceof z.ZodError) {
            //     setZoderr(err.issues[0].message)
            // }
        }
    }

    const handleOTPChange = (value: string) => {
        setOtp(value);
    };

    // const { mutate: resend, isPending: isResending } = useMutation({
    //     mutationFn: async (): Promise<GetNewOtpSuccess> => {
    //         const res = await fetch("/api/resend-otp", {
    //             method: "GET",
    //             headers: { "Content-Type": "application/json" },
    //             credentials: "include",
    //         });

    //         if (!res.ok) {
    //             const errData: GetNewOtpError = await res.json();

    //             toast.custom((t) => (
    //                 <div className="z-50 max-w-[400px] rounded-md border bg-background p-4 shadow-lg">
    //                     <div className="flex gap-2">
    //                         <div className="flex grow gap-3">
    //                             <CircleAlertIcon
    //                                 className="mt-0.5 shrink-0 text-red-500"
    //                                 size={20}
    //                                 aria-hidden="true"
    //                             />
    //                             <div className="flex grow flex-col gap-3">
    //                                 <p className="text-sm font-medium">
    //                                     {errData.message}
    //                                 </p>

    //                             </div>
    //                             <Button
    //                                 variant="ghost"
    //                                 className="group -my-1.5 -me-2 size-8 shrink-0 p-0 hover:bg-transparent cursor-pointer"
    //                                 aria-label="Close notification"
    //                                 onClick={() => toast.dismiss(t)}
    //                             >
    //                                 <XIcon
    //                                     size={20}
    //                                     className="opacity-60 transition-opacity group-hover:opacity-100"
    //                                     aria-hidden="true"
    //                                 />
    //                             </Button>
    //                         </div>
    //                     </div>
    //                 </div>
    //             ));
    //         }
    //         const data: GetNewOtpSuccess = await res.json();
    //         return data;
    //     },

    //     onSuccess: (data) => {
    //         toast.custom((t) => (
    //             <div className="z-50 max-w-[400px] rounded-md border bg-background p-4 shadow-lg">
    //                 <div className="flex gap-2">
    //                     <div className="flex grow gap-3">
    //                         <CircleCheckIcon
    //                             className="mt-0.5 shrink-0 text-red-500"
    //                             size={20}
    //                             aria-hidden="true"
    //                         />
    //                         <div className="flex grow flex-col gap-3">
    //                             <p className="text-sm font-medium">
    //                                 {data.message}
    //                             </p>

    //                         </div>
    //                         <Button
    //                             variant="ghost"
    //                             className="group -my-1.5 -me-2 size-8 shrink-0 p-0 hover:bg-transparent cursor-pointer"
    //                             aria-label="Close notification"
    //                             onClick={() => toast.dismiss(t)}
    //                         >
    //                             <XIcon
    //                                 size={16}
    //                                 className="opacity-60 transition-opacity group-hover:opacity-100"
    //                                 aria-hidden="true"
    //                             />
    //                         </Button>
    //                     </div>
    //                 </div>
    //             </div>
    //         ));
    //     },
    // });

    return (
        <div className=" flex items-center justify-center p-4 pt-20">
            <div className="w-full max-w-sm bg-white">
                <div className="text-center space-y-6">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <MailboxIcon className="w-8 h-8" />
                        <h1 className="text-xl font-bold text-gray-900">Check your inbox</h1>
                    </div>
                    <div className="max-w-prose text-base space-y-1">
                        <p className="text-zinc-500">
                            We&apos;ve sent a 6-digit verification code to your email
                        </p>
                        {/* <p className="text-zinc-500">
                            Please enter it below to continue.
                        </p> */}
                    </div>
                    <div className="flex justify-center gap-3 md:gap-4">
                        <OTPInput
                            length={6}
                            // onComplete={handleOTPComplete}
                            onValueChange={handleOTPChange}
                            disabled={isPending}
                            // error={hasError}
                            className="w-full justify-between"
                        />
                    </div>

                    {error ? (
                        <p className="px-1 inline-flex font-medium justify-center text-sm text-red-500">
                            {/* {error?.message} */}
                        </p>
                    ) : zoderr ? (
                        <p className="px-1 inline-flex font-medium  justify-center text-sm text-red-500">
                            {zoderr}
                        </p>
                    ) : null}
                    <Button
                        disabled={isPending}
                        className="w-full cursor-pointer"
                        onClick={() => {
                            if (zoderr.length > 1) {
                                setZoderr("")
                            }
                            handleVerify(otp)
                        }}
                    >
                        {isPending ? (
                            <div className="inline-flex items-center gap-2">
                                <CircleNotchIcon className="size-4 animate-spin" />
                                verifying
                            </div>
                        ) : "Continue"}
                    </Button>

                    <div className="flex items-center justify-center text-sm text-zinc-600">
                        Didn&apos;t receive the code?
                        <ResendButton />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default VerifyEmailForm;