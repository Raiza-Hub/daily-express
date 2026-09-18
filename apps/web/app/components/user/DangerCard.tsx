"use client";

import { useRouter } from "next/navigation";
import { useDeactivateDriver, useDeleteAccount } from "@repo/api";
import { Button } from "~/components/ui/button";

const DangerCard = () => {
    const router = useRouter();
    const deleteAccount = useDeleteAccount();
    const deactivateDriver = useDeactivateDriver();

    const handleDeleteAccount = () => {
        deleteAccount.mutate(undefined, {
            onSuccess: () => {
                router.push("/");
            },
        });
    };

    const handleDeactivateDriver = () => {
        deactivateDriver.mutate(undefined, {
            onSuccess: () => {
                router.push("/");
            },
        });
    };

    return (
        <div className="w-full min-w-0 max-w-3xl">
            <section className="flex flex-col items-start gap-4 border-b border-border py-6">
                <div>
                    <h2 className="text-sm font-semibold text-foreground">Delete user account</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Permanently deletes your account and driver profile. Your account data and history will be removed, and you will no longer have access to your account. This action cannot be undone.
                    </p>
                </div>
                <Button
                    type="button"
                    pill
                    onClick={handleDeleteAccount}
                    disabled={deleteAccount.isPending}
                    className="bg-red-600 font-semibold text-sm text-white hover:bg-red-700"
                >
                    Delete account
                </Button>
                {deleteAccount.isError ? (
                    <p className="text-sm text-destructive">{deleteAccount.error.message}</p>
                ) : null}
            </section>
            <section className="flex flex-col items-start gap-4 py-6">
                <div>
                    <h2 className="text-sm font-semibold text-foreground">Deactivate driver account</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Temporarily deactivate your driver profile and stop receiving new ride requests. Your account and profile information will be kept securely, and you can reactivate your driver profile whenever you’re ready to start driving again.
                    </p>
                </div>
                <Button
                    type="button"
                    pill
                    onClick={handleDeactivateDriver}
                    disabled={deactivateDriver.isPending}
                    className="bg-red-600 font-semibold text-sm text-white hover:bg-red-700"
                >
                    Deactivate driver
                </Button>
                {deactivateDriver.isError ? (
                    <p className="text-sm text-destructive">{deactivateDriver.error.message}</p>
                ) : null}
            </section>
        </div>
    );
};

export { DangerCard };
