"use client";

import { useState, useEffect } from "react";
import { useResendOtp } from "@repo/api";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/components/sonner";
import { posthogEvents } from "~/lib/posthog-events";
import { usePostHog } from "posthog-js/react";

const RESEND_COOLDOWN = 90;

const ResendButton = () => {
  const { mutate: resend, isPending } = useResendOtp();
  const [cooldown, setCooldown] = useState(0);
  const posthog = usePostHog();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = () => {
    if (cooldown > 0 || isPending) return;
    resend(undefined, {
      onSuccess: () => {
        posthog.capture(posthogEvents.auth_otp_resend_succeeded);
        setCooldown(RESEND_COOLDOWN);
        toast.success("Verification code resent successfully");
      },
      onError: (err) => {
        posthog.captureException(new Error(err.message), {
          action: "resendOtp",
        });
        toast.error(err.message);
      },
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Button
      variant="link"
      size="sm"
      type="button"
      onClick={handleResend}
      disabled={isPending || cooldown > 0}
      className="text-zinc-900 underline hover:text-zinc-700 cursor-pointer"
    >
      {isPending ? (
        <>
          <CircleNotchIcon className="size-4 animate-spin" />
          Resending
        </>
      ) : cooldown > 0 ? (
        `Resend in ${formatTime(cooldown)}`
      ) : (
        "Resend email"
      )}
    </Button>
  );
};

export default ResendButton;
