"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleNotchIcon, EyeClosedIcon, EyeIcon } from "@phosphor-icons/react";
import { SignUpSchema, TSignUpSchema, } from "@repo/types/authSchema";
import { Button } from "@repo/ui/components/button";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Icons } from "~/components/Icons";


const SignUpForm = () => {
    const router = useRouter();
    const id = useId();
    const isPending = false

    const [isPasswordFocused, setIsPasswordFocused] = useState(false);
    const [isVisible, setIsVisible] = useState<boolean>(false);



    // Form setup
    const {
        register,
        handleSubmit,
        formState: { errors },
        control,
        watch,
    } = useForm<TSignUpSchema>({
        resolver: zodResolver(SignUpSchema),
    });

    // Sign up mutation
    // const { mutate, isPending, error } = useMutation({
    //     mutationFn: async (userData: TSignUp): Promise<SignUpSuccess> => {
    //         const res = await fetch("/api/auth/sign-up", {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             credentials: "include",
    //             body: JSON.stringify(userData),
    //         });

    //         if (!res.ok) {
    //             const errorData: SignUpError = await res.json()
    //             throw new Error(errorData.message);
    //         }

    //         const data: SignUpSuccess = await res.json();
    //         return data;
    //     },
    //     onSuccess: () => {
    //         router.push("/verify-email");
    //     },
    //     // onError: (error: Error) => {
    //     //     toast.error(error.message || "Something went wrong");
    //     // },
    // });

    const onSubmit = async (data: TSignUpSchema) => {
        console.log(data);
    };

    const toggleVisibility = () => setIsVisible((prev) => !prev);

    const handleSignInWithGoogle = () => {
        throw new Error("Function not implemented.");
    }
    const handleSignInWithMicrosoft = () => {
        throw new Error("Function not implemented.");
    }


    return (
        <div className="grid gap-6">
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="grid gap-2">
                    {/* NAME FIELD */}
                    <div className="grid gap-2 py-2">
                        <Controller
                            name="firstName"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="firstName">
                                        First Name
                                    </FieldLabel>
                                    <Input
                                        {...field}
                                        id="firstName"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="First name on ID"
                                        autoComplete="off"
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
                            name="lastName"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="lastName">
                                        Last Name
                                    </FieldLabel>
                                    <Input
                                        {...field}
                                        id="lastName"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="Last name on ID"
                                        autoComplete="off"
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </div>

                    {/* EMAIL FIELD */}
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

                    <div className="grid gap-2 py-2">
                        <Controller
                            name="dateOfBirth"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="dateOfBirth">
                                        Date of Birth
                                    </FieldLabel>
                                    <Input
                                        {...field}
                                        id="dateOfBirth"
                                        type="date"
                                        aria-invalid={fieldState.invalid}
                                        value={field.value ? dayjs(field.value).format("YYYY-MM-DD") : ""}
                                        onChange={(e) =>
                                            field.onChange(
                                                e.target.value
                                                    ? dayjs(e.target.value, "YYYY-MM-DD").toDate()
                                                    : undefined
                                            )
                                        }
                                        className="bg-transparent [&::-webkit-calendar-picker-indicator]:hidden"
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />

                    </div>

                    {/* PASSWORD FIELD */}
                    <div className="grid gap-2 py-2">
                        <Controller
                            name="password"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="password">
                                        Password
                                    </FieldLabel>
                                    <div className="relative">
                                        <Input
                                            {...field}
                                            id="password"
                                            type={isVisible ? "text" : "password"}
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Password"
                                        />
                                        <button
                                            type="button"
                                            aria-label={isVisible ? "Hide password" : "Show password"}
                                            onClick={toggleVisibility}
                                            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-e-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {isVisible ? (
                                                <EyeIcon size={16} aria-hidden="true" />
                                            ) : (
                                                <EyeClosedIcon size={16} aria-hidden="true" />
                                            )}
                                        </button>
                                    </div>
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </div>
                    <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                        <span className="bg-card text-muted-foreground relative z-10 px-2">
                            Or continue with
                        </span>
                    </div>

                    <div className="flex flex-col gap-4 py-4">
                        <Button
                            variant="outline"
                            className="w-full cursor-pointer"
                            disabled={isPending}
                            onClick={handleSignInWithGoogle}
                        >
                            <Icons.google className="h-5 w-5" />
                            Continue with Google
                        </Button>

                        {/* <Button
                            variant="outline"
                            className="w-full cursor-pointer"
                            disabled={isPending}
                            onClick={handleSignInWithMicrosoft}

                        >
                            <Icons.microsoft className="h-5 w-5" />
                            Continue with Microsoft
                        </Button> */}
                    </div>

                    {/* SIGN UP BUTTON */}
                    {errors.root?.message && (
                        <p className="px-1 inline-flex justify-center text-sm text-red-500">
                            {errors.root.message}
                        </p>
                    )}
                    <Button className="cursor-pointer" disabled={isPending}>
                        {isPending ? <CircleNotchIcon className="size-4 animate-spin" /> : "Sign up"}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default SignUpForm;
