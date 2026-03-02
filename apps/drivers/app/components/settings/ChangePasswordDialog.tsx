"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, TChangePasswordSchema } from "@repo/types/authSchema";
import { Button } from "@repo/ui/components/button";
import { ResponsiveModal } from "@repo/ui/ResponsiveModal";
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

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={(val) => {
                if (!val) { setOpen(false); reset(); }
                else setOpen(true);
            }}
            trigger={
                <Button variant="secondary" className="cursor-pointer md:w-fit">Change Password</Button>
            }
            title="Change Password"
        >
            {formContent}
            <div className="px-4 pb-4 pt-2 flex justify-end gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => { setOpen(false); reset(); }}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    onClick={handleSubmit(onSubmit)}
                    className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Changing..." : "Change Password"}
                </Button>
            </div>
        </ResponsiveModal>
    );
}
