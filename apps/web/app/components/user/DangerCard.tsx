"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDeactivateDriver, useDeleteAccount, useGetDriver, useGetMe } from "@repo/api";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@repo/ui/Drawer";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type DangerAction = "delete" | "deactivate";

const DANGER_ACTIONS = {
    delete: {
        heading: "Delete user account",
        body: "Permanently deletes your account and driver profile. Your account data and history will be removed, and you will no longer have access to your account. This action cannot be undone.",
        title: "Permanently delete your account?",
        description: "This deletes your account, driver profile and all trip history. It cannot be undone.",
        action: "Delete account",
    },
    deactivate: {
        heading: "Deactivate driver account",
        body: "Temporarily deactivate your driver profile and stop receiving new ride requests. Your account and profile information will be kept securely. Contact support to reactivate your driver profile when you are ready to start driving again.",
        title: "Deactivate your driver profile?",
        description: "You will stop receiving new ride requests. Your profile and trip history are kept.",
        action: "Deactivate driver",
    },
} as const;

const dangerButtonStyles = "bg-red-600 font-semibold text-sm text-white hover:bg-red-700";

const DangerCard = ({ canDeactivate }: { canDeactivate: boolean }) => {
    const router = useRouter();
    const { data: user } = useGetMe();
    const { data: driver } = useGetDriver();
    const deleteAccount = useDeleteAccount();
    const deactivateDriver = useDeactivateDriver();

    const [action, setAction] = useState<DangerAction | null>(null);
    const [confirmInput, setConfirmInput] = useState("");

    const isDelete = action === "delete";
    const copy = DANGER_ACTIONS[isDelete ? "delete" : "deactivate"];
    const mutation = isDelete ? deleteAccount : deactivateDriver;
    const targetEmail = (isDelete ? user?.email : driver?.email) ?? "";

    const confirmed =
        confirmInput.trim().toLowerCase() === targetEmail.trim().toLowerCase() &&
        targetEmail.length > 0;

    const openDrawer = (next: DangerAction) => {
        setConfirmInput("");
        setAction(next);
        (next === "delete" ? deleteAccount : deactivateDriver).reset();
    };

    const closeDrawer = () => {
        setAction(null);
        setConfirmInput("");
    };

    // The session ends with the account, so land on a public route before
    // refreshing to keep `proxy.ts` from redirecting back to /login.
    const handleDelete = () => {
        closeDrawer();
        router.replace("/");
        router.refresh();
    };

    // Deactivation keeps the session, so only the server-rendered navbar and
    // the driver profile need to be re-read.
    const handleDeactivate = () => {
        closeDrawer();
        router.refresh();
    };

    const handleConfirm = () => {
        if (!confirmed || mutation.isPending) return;
        if (isDelete) {
            deleteAccount.mutate(undefined, { onSuccess: handleDelete });
        } else {
            deactivateDriver.mutate(undefined, { onSuccess: handleDeactivate });
        }
    };

    return (
        <div className="w-full min-w-0 max-w-3xl">
            <section className="flex flex-col items-start gap-4 py-6">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        {DANGER_ACTIONS.delete.heading}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {DANGER_ACTIONS.delete.body}
                    </p>
                </div>
                <Button type="button" pill onClick={() => openDrawer("delete")} className={dangerButtonStyles}>
                    {DANGER_ACTIONS.delete.action}
                </Button>
            </section>

            {canDeactivate ? (
                <section className="flex flex-col items-start gap-4 border-t border-border py-6">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            {DANGER_ACTIONS.deactivate.heading}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {DANGER_ACTIONS.deactivate.body}
                        </p>
                    </div>
                    <Button
                        type="button"
                        pill
                        onClick={() => openDrawer("deactivate")}
                        className={dangerButtonStyles}
                    >
                        {DANGER_ACTIONS.deactivate.action}
                    </Button>
                </section>
            ) : null}

            <Drawer open={action !== null} onOpenChange={closeDrawer}>
                <DrawerContent>
                    <div className="mx-auto w-full max-w-lg overflow-y-auto">
                        <DrawerHeader className="text-left">
                            <DrawerTitle>{copy.title}</DrawerTitle>
                            <DrawerDescription>{copy.description}</DrawerDescription>
                        </DrawerHeader>

                        <div className="flex flex-col gap-4 px-4 pb-4">
                            <label
                                htmlFor="danger-confirm-email"
                                className="text-sm font-medium text-foreground"
                            >
                                Type your email to confirm
                            </label>

                            <Input
                                id="danger-confirm-email"
                                type="email"
                                inputMode="email"
                                autoComplete="off"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                value={confirmInput}
                                placeholder={targetEmail}
                                onChange={(event) => setConfirmInput(event.target.value)}
                            />

                            {mutation.isError ? (
                                <p role="alert" className="text-sm text-destructive">
                                    {mutation.error.message}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <DrawerFooter>
                        <Button
                            type="button"
                            pill
                            onClick={handleConfirm}
                            disabled={!confirmed || mutation.isPending}
                            className={dangerButtonStyles}
                        >
                            {copy.action}
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    );
};

export { DangerCard };