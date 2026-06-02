"use client";

import { TrashIcon } from "@phosphor-icons/react";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/components/sonner";
import { useDeactivateDriver, useLogout } from "@repo/api";
import { env } from "~/env";
import { posthogEvents } from "~/lib/posthog-events";
import { usePostHog } from "posthog-js/react";

const DeleteAccount = () => {
  const { mutate: signOut } = useLogout();
  const { mutate: deactivateDriver, isPending } = useDeactivateDriver();
  const posthog = usePostHog();

  const handleDelete = () => {
    deactivateDriver(undefined, {
      onSuccess: () => {
        posthog.capture(posthogEvents.driver_account_deactivate_succeeded);
        signOut(undefined, {
          onSuccess: () => {
            posthog.capture(posthogEvents.driver_logout_succeeded);
            window.location.href = `${env.NEXT_PUBLIC_WEB_APP_URL}/sign-in`;
          },
        });
      },
      onError: (err) => {
        posthog.captureException(new Error(err.message), {
          action: posthogEvents.driver_account_deactivate_failed,
        });
        toast.error(err.message);
      },
    });
  };

  return (
    <div className="mt-10 pt-6 border-t border-red-100">
      <div className="mb-6 py-4 border-b border-gray-100">
        <h2 className="text-xl font-semibold mb-1 text-red-600">
          Deactivate Account
        </h2>
        <p className="text-sm text-muted-foreground">
          Once you deactivate your account, you will lose access to the
          platform. Your data will be retained for record-keeping purposes.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Deactivate my account</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Once deactivated, your account will no longer be accessible.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          className="cursor-pointer"
          disabled={isPending}
          onClick={handleDelete}
        >
          <TrashIcon className="size-4" />
          <span>Deactivate Account</span>
        </Button>
      </div>
    </div>
  );
};

export default DeleteAccount;
