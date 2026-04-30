"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { Icons } from "@repo/ui/Icons";
import { env } from "~/env";
import { posthogEvents } from "~/lib/posthog-events";
import { usePostHog } from "posthog-js/react";

interface GoogleSignInButtonProps {
  disabled?: boolean;
  onClick?: () => void;
  redirect?: string;
}

const GoogleSignInButton = ({
  disabled,
  onClick,
  redirect,
}: GoogleSignInButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const posthog = usePostHog();

  const handleSignInWithGoogle = () => {
    setIsLoading(true);
    onClick?.();
    posthog.capture(posthogEvents.auth_google_signin_clicked);
    const apiUrl = env.NEXT_PUBLIC_API_GATEWAY_URL;
    const stateParam = redirect ? `?state=${encodeURIComponent(redirect)}` : "";
    window.location.href = `${apiUrl}/api/auth/v1/auth/google${stateParam}`;
  };

  const showSpinner = isLoading;

  return (
    <Button
      variant="secondary"
      className="w-full cursor-pointer"
      disabled={isLoading || disabled}
      onClick={handleSignInWithGoogle}
      type="button"
    >
      {showSpinner ? (
        <CircleNotchIcon className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icons.google className="mr-2 h-5 w-5" />
      )}
      Continue with Google
    </Button>
  );
};

export default GoogleSignInButton;
