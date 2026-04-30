"use client";

import { TrashIcon } from "@phosphor-icons/react";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/components/sonner";
import { useDeleteDriver, useLogout } from "@repo/api";
import { env } from "~/env";
import { posthogEvents } from "~/lib/posthog-events";
import { usePostHog } from "posthog-js/react";

const DeleteAccount = () => {
  const { mutate: signOut } = useLogout();
  const { mutate: deleteDriver, isPending } = useDeleteDriver();
  const posthog = usePostHog();

  const handleDelete = () => {
    deleteDriver(undefined, {
      onSuccess: () => {
        posthog.capture(posthogEvents.driver_account_delete_succeeded);
        signOut(undefined, {
          onSuccess: () => {
            posthog.capture(posthogEvents.driver_logout_succeeded);
            window.location.href = `${env.NEXT_PUBLIC_WEB_APP_URL}/sign-in`;
          },
        });
      },
      onError: (err) => {
        posthog.captureException(new Error(err.message), {
          action: "account_delete_failed",
        });
        toast.error(err.message);
      },
    });
  };

  return (
    <div className="mt-10 pt-6 border-t border-red-100">
      <div className="mb-6 py-4 border-b border-gray-100">
        <h2 className="text-xl font-semibold mb-1 text-red-600">
          Delete Account
        </h2>
        <p className="text-sm text-muted-foreground">
          Once you delete your account, there is no going back. All your data
          will be permanently removed from the platform.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Permanently delete my account</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            This action is irreversible. Please be certain before proceeding.
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
          <span>Delete Account</span>
        </Button>
      </div>
    </div>
  );
};

export default DeleteAccount;
