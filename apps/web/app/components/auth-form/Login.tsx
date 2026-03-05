"use client";

;
import { zodResolver } from "@hookform/resolvers/zod";
import { SignInSchema, TSignInSchema } from "@repo/types/authSchema";
import { Button } from "@repo/ui/components/button";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Icons } from "../Icons";
import { CircleNotchIcon } from "@phosphor-icons/react";


const LoginForm = () => {
    const router = useRouter();
    const isPending = false

    const {
        register,
        handleSubmit,
        formState: { errors },
        control,
    } = useForm<TSignInSchema>({
        resolver: zodResolver(SignInSchema),
    });

    const handleSignInWithGoogle = async () => {

    };

    // const { mutate, isPending, error } = useMutation({
    //     mutationFn: async (userData: TSignIn): Promise<SignInResponse> => {
    //         const res = await fetch("/api/auth/sign-in", {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             credentials: "include",
    //             body: JSON.stringify(userData),
    //         });

    //         const data: SignInResponse = await res.json();

    //         if (!res.ok) {
    //             throw new Error(data.message);
    //         }

    //         return data;
    //     },
    //     onSuccess: () => {
    //         router.push("/dashboard");
    //     },
    //     // onError: (error: any) => {
    //     //     toast.error(error.message || "Something went wrong");
    //     // },
    // });

    const onSubmit = async (data: TSignInSchema) => {
        console.log(data);
    };

    return (
        <div className="grid gap-6">
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="grid gap-2">
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
                            name="password"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <div className="flex items-center justify-between">
                                        <FieldLabel htmlFor="password">
                                            Password
                                        </FieldLabel>
                                        <Link href="/forget-password" className="text-sm text-muted-foreground">
                                            Forgot password?
                                        </Link>
                                    </div>
                                    <div className="relative">
                                        <Input
                                            {...field}
                                            id="password"
                                            type="password"
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Password"
                                        />
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
                            variant="secondary"
                            className="w-full cursor-pointer"
                            disabled={isPending}
                            onClick={handleSignInWithGoogle}
                        >
                            <Icons.google className="h-5 w-5" />
                            Continue with Google
                        </Button>
                    </div>

                    {errors && (
                        <p className="px-1 inline-flex justify-center text-sm text-red-500">
                            {/* {error} */}
                        </p>
                    )}

                    <Button className="cursor-pointer" variant="submit" disabled={isPending} type="submit">
                        {isPending ? (
                            <CircleNotchIcon className="size-4 animate-spin" />
                        ) : (
                            "Sign in"
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default LoginForm;
