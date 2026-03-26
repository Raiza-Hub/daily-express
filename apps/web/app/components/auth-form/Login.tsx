"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SignInSchema, TSignInSchema } from "@repo/types/authSchema";
import { useLogin } from "@repo/api";
import { Button } from "@repo/ui/components/button";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { toast } from "@repo/ui/components/sonner";
import GoogleSignInButton from "./GoogleSignInButton";
import { useState } from "react";

const LoginForm = () => {
  const router = useRouter();
  const { mutate: login, isPending, error } = useLogin();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const { handleSubmit, control, setError } = useForm<TSignInSchema>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: TSignInSchema) => {
    login(
      {
        email: data.email,
        password: data.password,
      },
      {
        onSuccess: () => {
          router.push("/");
        },
        onError: (err) => {
          setError("root", {
            message: err.message || "Something went wrong",
          });
          toast.error(err.message);
        },
      },
    );
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
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="email"
                    aria-invalid={fieldState.invalid}
                    placeholder="Enter your email address"
                    autoComplete="email"
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
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Link
                      href="/forget-password"
                      className="text-sm text-muted-foreground"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      {...field}
                      id="password"
                      type="password"
                      aria-invalid={fieldState.invalid}
                      placeholder="Enter your password"
                      autoComplete="current-password"
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
            <GoogleSignInButton
              disabled={isPending || isGoogleLoading}
              onClick={() => setIsGoogleLoading(true)}
            />
          </div>

          {/* {error && (
            <p className="px-1 inline-flex justify-center text-xs text-center text-red-500">
              {error?.message}
            </p>
          )} */}

          <Button
            className="cursor-pointer"
            variant="submit"
            disabled={isPending || isGoogleLoading}
            type="submit"
          >
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
