"use client";

import { MailboxIcon } from "@phosphor-icons/react";
import { getDriverFn, useQueryClient, useVerifyOtp } from "@repo/api";
import { OtpSchema } from "@repo/types/authSchema";
import { Button } from "@repo/ui/components/button";
import { OTPInput } from "@repo/ui/OTPInput";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resolvePostAuthDestination } from "~/lib/app-routing";
import { posthogEvents } from "~/lib/posthog-events";
import ResendButton from "./ResendButton";
import { usePostHog } from "posthog-js/react";

const VerifyEmailForm = ({ redirect }: { redirect?: string }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutate: verifyOtp, isPending, error } = useVerifyOtp();
  const [otp, setOtp] = useState<string>("");
  const [zodErr, setZodErr] = useState<string>("");
  const posthog = usePostHog();

  const handleVerify = () => {
    try {
      OtpSchema.parse(otp);
      verifyOtp(
        { otp },
        {
          onSuccess: async () => {
            posthog.capture(posthogEvents.auth_email_verified);
            queryClient.invalidateQueries();
            let isDriver = false;

            try {
              await getDriverFn();
              isDriver = true;
            } catch (error) {
              if (
                !(error instanceof Error) ||
                !error.message.toLowerCase().includes("driver not found")
              ) {
                console.error(
                  "Driver lookup failed after email verification",
                  error,
                );
              }
            }

            const destination = resolvePostAuthDestination({
              redirect,
              isDriver,
            });

            if (
              destination.startsWith("http://") ||
              destination.startsWith("https://")
            ) {
              window.location.assign(destination);
              return;
            }

            router.push(destination);
          },
          onError: (err) => {
            posthog.captureException(new Error(err.message), {
              action: "verifyEmailOtp",
              values: { otpLength: otp.length },
            });
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
            <h1 className="text-xl font-bold text-gray-900">
              Check your inbox
            </h1>
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

          {zodErr ? (
            <p className="px-1 inline-flex font-medium justify-center text-sm text-red-500">
              {zodErr}
            </p>
          ) : error ?
              <p className="px-1 inline-flex font-medium justify-center text-sm text-red-500">
                {error.message}
              </p>
            :
          null}
          <Button
            disabled={isPending || otp.length !== 6}
            className="w-full cursor-pointer"
            variant="submit"
            type="button"
            onClick={handleVerify}
          >
            Continue
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
