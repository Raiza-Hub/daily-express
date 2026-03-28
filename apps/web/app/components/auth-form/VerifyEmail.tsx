"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVerifyOtp, useGetMe, useQueryClient } from "@repo/api";
import { OtpSchema } from "@repo/types/authSchema";
import { Button } from "@repo/ui/components/button";
import { CircleNotchIcon, MailboxIcon } from "@phosphor-icons/react";
import { OTPInput } from "@repo/ui/OTPInput";
import ResendButton from "./ResendButton";
import { toast } from "@repo/ui/components/sonner";

const VerifyEmailForm = () => {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { mutate: verifyOtp, isPending } = useVerifyOtp();
    const [otp, setOtp] = useState<string>("");
    const [zodErr, setZodErr] = useState<string>("");
    const [serverErr, setServerErr] = useState<string>("");

    const handleVerify = () => {
        setServerErr("");
        try {
            OtpSchema.parse(otp);
            verifyOtp(
                { otp },
                {
                    onSuccess: () => {
                        queryClient.invalidateQueries();
                        router.push("/");
                    },
                    onError: (err) => {
                        setServerErr(err.message);
                        toast.error(err.message);
                    },
                },
            );
        } catch {
            setZodErr("OTP must be exactly 6 digits");
        }
    };

    const handleOTPChange = (value: string) => {
        setOtp(value);
        setZodErr("");
    };

    return (
        <div className="flex items-center justify-center p-4 pt-20">
            <div className="w-full max-w-sm bg-white">
                <div className="text-center space-y-6">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <MailboxIcon className="w-8 h-8" />
                        <h1 className="text-xl font-bold text-gray-900">Check your inbox</h1>
                    </div>
                    <div className="max-w-prose text-sm space-y-1">
                        <p className="text-zinc-500">
                            We&apos;ve sent a 6-digit verification code to your email
                        </p>
                    </div>
                    <div>
                        <OTPInput
                            length={6}
                            onValueChange={handleOTPChange}
                            disabled={isPending}
                            className="w-full justify-between"
                        />
                    </div>

                    {serverErr ? (
                        <p className="px-1 inline-flex font-medium justify-center text-sm text-red-500">
                            {serverErr}
                        </p>
                    ) : zodErr ? (
                        <p className="px-1 inline-flex font-medium justify-center text-sm text-red-500">
                            {zodErr}
                        </p>
                    ) : null}
                    <Button
                        disabled={isPending || otp.length !== 6}
                        className="w-full cursor-pointer"
                        variant="submit"
                        type="button"
                        onClick={handleVerify}
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
};

export default VerifyEmailForm;