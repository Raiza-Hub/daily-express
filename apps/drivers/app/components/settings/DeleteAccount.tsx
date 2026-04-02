"use client";

import { CircleNotchIcon, TrashIcon } from "@phosphor-icons/react";
import { Button } from "@repo/ui/components/button";
import { useRouter } from "next/navigation";
import { toast } from "@repo/ui/components/sonner";
import { useDeleteDriver, useLogout } from "@repo/api";

const DeleteAccount = () => {
  const router = useRouter();
  const { mutate: signOut } = useLogout();
  const { mutate: deleteDriver, isPending } = useDeleteDriver();

  const handleDelete = () => {
    deleteDriver(undefined, {
      onSuccess: () => {
        signOut(undefined, {
          onSuccess: () => {
            router.push("/sign-in");
          },
        });
      },
      onError: (err) => {
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
          {isPending ? (
            <>
              <CircleNotchIcon className="size-4 animate-spin" />
              <span>Deleting account</span>
            </>
          ) : (
            <>
              <TrashIcon className="size-4" />
              <span>Delete Account</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default DeleteAccount;
