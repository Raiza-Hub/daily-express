"use client";
import { useEffect, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";

import { posthogEvents } from "~/lib/posthog-events";

export function cookieConsentGiven() {
  if (!localStorage.getItem("cookie_consent")) {
    return "undecided";
  }
  return localStorage.getItem("cookie_consent");
}

export default function Banner() {
  const [consentGiven, setConsentGiven] = useState("");
  const posthog = usePostHog();

  useEffect(() => {
    setConsentGiven(cookieConsentGiven() || "undecided");
  }, []);

  useEffect(() => {
    if (consentGiven !== "") {
      posthog.set_config({
        persistence: consentGiven === "yes" ? "localStorage+cookie" : "memory",
      });
    }
  }, [consentGiven, posthog]);

  const handleAcceptCookies = () => {
    localStorage.setItem("cookie_consent", "yes");
    setConsentGiven("yes");
    posthog.capture(posthogEvents.cookie_consent_accepted);
  };

  const handleDeclineCookies = () => {
    localStorage.setItem("cookie_consent", "no");
    setConsentGiven("no");
    posthog.capture(posthogEvents.cookie_consent_declined);
  };

  return (
    <div
      className="fixed bottom-6 left-6 z-50 pointer-events-none"
      aria-live="polite"
    >
      {/* Only show the banner if consent is undecided */}
      {consentGiven === "undecided" && (
        <div
          className={cn(
            "pointer-events-auto max-w-sm w-full bg-white border border-gray-200 shadow-xl rounded-xl p-5 flex flex-col gap-4 animate-in fade-in-0 slide-in-from-bottom-4"
          )}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            {/* Decorative cookie icon */}
            <div className="w-8 h-8 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-14 h-14"
                src="https://raw.githubusercontent.com/prebuiltui/prebuiltui/main/assets/cookies/cookieImage1.svg"
                alt="cookieImage1"
              />

            </div>

            <h3 className="font-semibold text-neutral-900 text-base">
              Cookie settings
            </h3>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            We use cookies to keep things running smoothly, understand how you use the app, and improve your trip experience every time you use our service.
          </p>


          {/* Actions */}
          <div className="flex gap-3 mt-2">
            <Button
              type="button"
              variant="softBlue"
              size="sm"
              onClick={handleDeclineCookies}
              className="flex-1"
            >
              Decline
            </Button>

            <Button
              type="button"
              variant="submit"
              size="sm"
              onClick={handleAcceptCookies}
              className="flex-1 "
            >
              Accept all
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
