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
    Field,
    FieldError,
    FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

export default function ChangePasswordDialog() {
    const [open, setOpen] = useState(false);

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
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setOpen(false);
        reset();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="w-fit" asChild>
                <Button variant="secondary">Change Password</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="grid gap-4">
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

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            className="bg-green-500 hover:bg-green-600 text-white"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Changing..." : "Change Password"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
