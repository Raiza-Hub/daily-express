"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { Icons } from "@repo/ui/Icons";

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

  const handleSignInWithGoogle = () => {
    setIsLoading(true);
    onClick?.();
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/v1";
    const stateParam = redirect ? `?state=${encodeURIComponent(redirect)}` : "";
    window.location.href = `${apiUrl}/auth/google${stateParam}`;
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
