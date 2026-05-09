"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { useDisconnectProvider, useSetPassword } from "@repo/api";
import { posthogEvents } from "~/lib/posthog-events";
import { usePostHog } from "posthog-js/react";

interface DisconnectGoogleDialogProps {
  hasPassword: boolean;
  onSuccess: () => void;
}

export default function DisconnectGoogleDialog({
  hasPassword,
  onSuccess,
}: DisconnectGoogleDialogProps) {
  const [disconnectPassword, setDisconnectPassword] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const posthog = usePostHog();

  const { mutate: disconnectProvider, isPending: isDisconnecting } =
    useDisconnectProvider({
      onSuccess: () => {
        posthog.capture(posthogEvents.driver_google_disconnect_succeeded);
        onSuccess();
        setIsOpen(false);
      },
      onError: (err) => {
        posthog.captureException(new Error(err.message), {
          action: "google_disconnect",
        });
        setGoogleError(err.message);
      },
    });

  const { mutate: setPasswordMutation, isPending: isSettingPassword } =
    useSetPassword({
      onSuccess: () => {
        posthog.capture(posthogEvents.driver_password_set_succeeded);
        setDisconnectPassword("");
        disconnectProvider("google");
      },
      onError: (err) => {
        posthog.captureException(new Error(err.message), {
          action: "set_password",
        });
        setGoogleError(err.message);
      },
    });

  const handleDisconnect = () => {
    if (hasPassword) {
      disconnectProvider("google");
    } else if (disconnectPassword) {
      setPasswordMutation(disconnectPassword);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="cursor-pointer text-red-500">
          Disconnect
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Disconnect Google Account?</DialogTitle>
          <DialogDescription>
            {hasPassword
              ? "Are you sure you want to disconnect your Google account?"
              : "You'll need your password to log in after disconnecting Google."}
          </DialogDescription>
        </DialogHeader>

        {!hasPassword && (
          <div className="grid gap-4 py-4">
            <Field>
              <FieldLabel htmlFor="disconnectPassword">Password</FieldLabel>
              <Input
                id="disconnectPassword"
                type="password"
                placeholder="Enter a new password"
                value={disconnectPassword}
                onChange={(e) => setDisconnectPassword(e.target.value)}
              />
            </Field>
          </div>
        )}

        <DialogFooter>
          {googleError && (
            <p className="px-1 pb-2 inline-flex justify-center text-sm text-red-500">
              {googleError}
            </p>
          )}
          <Button
            variant="destructive"
            onClick={handleDisconnect}
            disabled={
              isDisconnecting ||
              isSettingPassword ||
              (!hasPassword && disconnectPassword.length < 8)
            }
            className="w-full cursor-pointer"
          >
            {hasPassword ? "Disconnect Google" : "Set Password & Disconnect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
