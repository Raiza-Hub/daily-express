"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CircleNotchIcon, PasswordIcon } from "@phosphor-icons/react"
import { ResetPasswordSchema, TresetPasswordSchema } from "@repo/types/authSchema"
import { Button } from "@repo/ui/components/button"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { OTPInput } from "input-otp"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"


const ResetPasswordForm = () => {
    const router = useRouter();
    const isPending = false

    // const forgetPasswordEmail = useForgetPasswordEmail();
    // const clearForgetPasswordEmail = useclearForgetPasswordEmailActions();

    const {
        register,
        handleSubmit,
        formState: { errors },
        control
    } = useForm<TresetPasswordSchema>({
        resolver: zodResolver(ResetPasswordSchema),
    });




    // const { mutate, isPending, error, reset } = useMutation({
    //     mutationFn: async (userData: TresetPassword): Promise<ForgotPassword> => {
    //         const res = await fetch("/api/auth/reset-password", {
    //             method: "PUT",
    //             headers: { "Content-Type": "application/json" },
    //             credentials: "include",
    //             body: JSON.stringify(userData),
    //         });

    //         const data: ForgotPassword = await res.json();

    //         if (!res.ok) {
    //             throw new Error(data.message);
    //         }

    //         return data;
    //     },
    //     onSuccess: () => {
    //         clearForgetPasswordEmail();
    //         router.replace("/sign-in");
    //     },
    // });

    const onSubmit = async (data: TresetPasswordSchema) => {
        console.log(data);
    };


    return (
        <div className="flex items-center justify-center p-4 pt-20">
            <div className="w-full max-w-sm bg-white">
                <div className="text-center space-y-6">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <PasswordIcon className="w-8 h-8" />
                        <h1 className="text-xl font-bold text-gray-900">Set new password</h1>
                    </div>
                    <div className="max-w-prose text-sm space-y-1">
                        <p className="text-zinc-500">
                            No worries, we&apos;ll send you reset instructions.
                        </p>
                        {/* <p className="text-zinc-500">
                            Please enter it below to continue.
                        </p> */}
                    </div>
                    <div>
                        <form className="w-full" onSubmit={handleSubmit(onSubmit)}>
                            <div className="grid gap-2">
                                {/* <div className="grid gap-2 py-2">
                                <Controller
                                    name="email"
                                    control={control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="email">
                                                Email
                                            </FieldLabel>
                                            <Input
                                                {...field}
                                                id="email"
                                                aria-invalid={fieldState.invalid}
                                                placeholder="you@example.com"
                                                autoComplete="off"
                                            />
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            </div> */}

                                <div className="grid gap-2 py-2">
                                    <Controller
                                        name="newPassword"
                                        control={control}
                                        render={({ field, fieldState }) => (
                                            <Field data-invalid={fieldState.invalid}>
                                                <FieldLabel htmlFor="password">
                                                    Password
                                                </FieldLabel>
                                                <Input
                                                    {...field}
                                                    id="password"
                                                    type="password"
                                                    aria-invalid={fieldState.invalid}
                                                    placeholder="Password"
                                                />
                                                {fieldState.invalid && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        )}
                                    />

                                </div>

                                <div className="grid gap-2 py-2">
                                    <Controller
                                        name="confirmPassword"
                                        control={control}
                                        render={({ field, fieldState }) => (
                                            <Field data-invalid={fieldState.invalid}>
                                                <FieldLabel htmlFor="password">
                                                    Confirm Password
                                                </FieldLabel>
                                                <Input
                                                    {...field}
                                                    id="password"
                                                    type="password"
                                                    aria-invalid={fieldState.invalid}
                                                    placeholder="Password"
                                                />
                                                {fieldState.invalid && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        )}
                                    />
                                </div>
                                {errors && (
                                    <p className="px-1 inline-flex font-medium justify-center text-sm text-red-500">
                                        {/* {error.message} */}
                                    </p>
                                )}
                                <Button
                                    type="submit"
                                    variant="submit"
                                    disabled={isPending}
                                    className="w-full cursor-pointer"
                                >
                                    {isPending ? (
                                        <div className="inline-flex items-center gap-2">
                                            <CircleNotchIcon className="size-4 animate-spin" />
                                            sending...
                                        </div>
                                    ) : "Reset Password"}
                                </Button>
                            </div>
                        </form>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default ResetPasswordForm;