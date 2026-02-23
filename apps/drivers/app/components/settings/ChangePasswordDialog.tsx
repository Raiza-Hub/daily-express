"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, TChangePasswordSchema } from "@repo/types/authSchema";
import { Button } from "@repo/ui/components/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@repo/ui/components/dialog";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@repo/ui/components/drawer";
import {
    Field,
    FieldError,
    FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { useIsMobile } from "@repo/ui/hooks/use-is-mobile";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

export default function ChangePasswordDialog() {
    const [open, setOpen] = useState(false);
    const isMobile = useIsMobile();

    const {
        control,
        handleSubmit,
        reset,
        formState: { isSubmitting },
    } = useForm<TChangePasswordSchema>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            oldPassword: "",
            newPassword: "",
        },
    });

    const onSubmit = async (data: TChangePasswordSchema) => {
        console.log("Change password submitted:", data);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setOpen(false);
        reset();
    };

    const formContent = (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4 px-4">
            <div className="grid gap-6">
                <div className="grid gap-2">
                    <Controller
                        name="oldPassword"
                        control={control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel>Old Password</FieldLabel>
                                <Input
                                    {...field}
                                    type="password"
                                    placeholder="Your Old Password"
                                />
                                {fieldState.invalid && (
                                    <FieldError errors={[fieldState.error]} />
                                )}
                            </Field>
                        )}
                    />
                </div>

                <div className="grid gap-2">
                    <Controller
                        name="newPassword"
                        control={control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel>New Password</FieldLabel>
                                <Input
                                    {...field}
                                    type="password"
                                    placeholder="Your New Password"
                                />
                                {fieldState.invalid && (
                                    <FieldError errors={[fieldState.error]} />
                                )}
                            </Field>
                        )}
                    />
                </div>
            </div>
        </form>
    );

    if (isMobile) {
        return (
            <Drawer
                open={open}
                onOpenChange={(val) => {
                    setOpen(val);
                    if (!val) reset();
                }}
            >
                <DrawerTrigger asChild>
                    <Button variant="secondary" className="cursor-pointer">Change Password</Button>
                </DrawerTrigger>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle>Change Password</DrawerTitle>
                    </DrawerHeader>
                    {formContent}
                    <DrawerFooter>
                        <Button
                            type="submit"
                            onClick={handleSubmit(onSubmit)}
                            className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Changing..." : "Change Password"}
                        </Button>
                        <DrawerClose asChild>
                            <Button type="button" variant="secondary" className="cursor-pointer">
                                Cancel
                            </Button>
                        </DrawerClose>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(val) => {
                setOpen(val);
                if (!val) reset();
            }}
        >
            <DialogTrigger className="w-fit cursor-pointer" asChild>
                <Button variant="secondary">Change Password</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                </DialogHeader>

                {formContent}

                <DialogFooter className="px-4 pb-4">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" className="cursor-pointer">Cancel</Button>
                    </DialogClose>
                    <Button
                        type="submit"
                        onClick={handleSubmit(onSubmit)}
                        className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Changing..." : "Change Password"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
