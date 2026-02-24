"use client"


// import { useForgetPasswordEmailActions } from "@/app/stores/forget-password-store"

// import { cn } from "@/lib/utils"
// import { forgetPassword, TForgetPassword } from "@/lib/validators/auth"
// import { ForgotPassword } from "@/type"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleNotchIcon, KeyIcon } from "@phosphor-icons/react"
import { ForgetPasswordSchema, TForgetPasswordSchema } from "@repo/types/authSchema"
import { Button } from "@repo/ui/components/button"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
// import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"


const ForgetPasswordForm = () => {
    const router = useRouter();
    // const setForgetPasswordEmail = useForgetPasswordEmailActions();
    const isPending = false

    const {
        register,
        handleSubmit,
        formState: { errors },
        control
    } = useForm<TForgetPasswordSchema>({
        resolver: zodResolver(ForgetPasswordSchema),
    });

    // const { mutate, isPending, error } = useMutation({
    //     mutationFn: async (userData: TForgetPassword): Promise<ForgotPassword> => {
    //         const res = await fetch("/api/auth/forget-password", {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             credentials: "include",
    //             body: JSON.stringify(userData),
    //         });

    //         const data: ForgotPassword = await res.json();

    //         if (!res.ok) {
    //             throw new Error(data.message);
    //         }

    //         // setForgetPasswordEmail(userData.email)
    //         return data;
    //     },
    //     onSuccess: () => {
    //         router.push("/reset-password");
    //     },
    // });

    const onSubmit = async (data: TForgetPasswordSchema) => {
        console.log(data);
    };


    return (
        <div className="flex items-center justify-center p-4 pt-20">
            <div className="w-full max-w-sm bg-white">
                <div className="text-center space-y-6">
                    <div className="flex flex-col items-center justify-center gap-3">
                        <KeyIcon className="w-8 h-8" />
                        <h1 className="text-xl font-bold text-gray-900">Forget password?</h1>
                    </div>
                    <div className="max-w-prose text-sm space-y-1">
                        <p className="text-zinc-500">
                            No worries, we&apos;ll send you reset instructions.
                        </p>
                        {/* <p className="text-zinc-500">
                            Please enter it below to continue.
                        </p> */}
                    </div>
                    <div className="flex justify-center gap-3 md:gap-4">
                        <form className="w-full">
                            <div className="grid gap-2 py-2">
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
                            </div>
                        </form>
                    </div>

                    {errors && (
                        <p className="px-1 inline-flex font-medium justify-center text-sm text-red-500">
                            {/* {error.message} */}
                        </p>
                    )}
                    
                    <Button
                        disabled={isPending}
                        className="w-full cursor-pointer"
                        onClick={handleSubmit(onSubmit)}
                    >
                        {isPending ? (
                            <div className="inline-flex items-center gap-2">
                                <CircleNotchIcon className="size-4 animate-spin" />
                                sending...
                            </div>
                        ) : "Continue"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default ForgetPasswordForm;