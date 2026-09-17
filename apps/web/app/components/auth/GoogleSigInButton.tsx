"use client";

import { useState } from "react";
// import { googleAuthUrl } from "@repo/api";

import { Google } from "../Icons";

const GoogleSignInButton = () => {
    const [isLoading, setIsLoading] = useState(false);

    const handleSignInWithGoogle = () => {
        setIsLoading(true);
        // window.location.assign(googleAuthUrl);
    };

    const showSpinner = isLoading;

    return (
        <button
            className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 transition-colors duration-150 hover:bg-zinc-50 active:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-60"
            onClick={handleSignInWithGoogle}
            type="button"
            disabled={isLoading}
        >
            {showSpinner ? (
                <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                    aria-hidden="true"
                />
            ) : (
                <Google className="h-5 w-5" />
            )}
            Continue with Google
        </button>
    );
};

export default GoogleSignInButton;