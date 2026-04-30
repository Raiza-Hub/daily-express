"use client";

import { useForgotPassword } from "@repo/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyIcon } from "@phosphor-icons/react";
import {
  ForgetPasswordSchema,
  TForgetPasswordSchema,
} from "@repo/types/authSchema";
import { Button, buttonVariants } from "@repo/ui/components/button";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { toast } from "@repo/ui/components/sonner";
import { posthogEvents } from "~/lib/posthog-events";
import { usePostHog } from "posthog-js/react";

const ForgetPasswordForm = () => {
  const { mutate: forgotPassword, isPending, error } = useForgotPassword();
  const posthog = usePostHog();

  const { handleSubmit, control } = useForm<TForgetPasswordSchema>({
    resolver: zodResolver(ForgetPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (data: TForgetPasswordSchema) => {
    forgotPassword(data.email, {
      onSuccess: () => {
        posthog.capture(posthogEvents.auth_forgot_password_request_succeeded);
        toast.success("Verification link sent successfully");
      },
      onError: (err) => {
        posthog.captureException(new Error(err.message), {
          action: "forgotPasswordRequest",
          values: { email: data.email },
        });
        // toast.error("Something went wrong");
      },
    });
  };

  return (
    <div className="flex items-center justify-center p-4 pt-20">
      <div className="w-full max-w-sm bg-white">
        <div className="text-center space-y-6">
          <div className="flex flex-col items-center justify-center gap-3">
            <KeyIcon className="w-8 h-8" />
            <h1 className="text-xl font-bold text-gray-900">
              Forgot your password?
            </h1>
          </div>
          <div className="max-w-prose text-sm space-y-1">
            <p className="text-zinc-500">
              No worries. Enter your email address and we&apos;ll send you a
              link to reset it.
            </p>
          </div>
          <div>
            <form className="w-full" onSubmit={handleSubmit(onSubmit)}>
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

                {error && (
                  <p className="px-1 inline-flex justify-center text-sm text-red-500">
                    {error?.message}
                  </p>
                )}

                <Button
                  disabled={isPending}
                  variant="submit"
                  type="submit"
                  className="w-full cursor-pointer"
                >
                  Continue
                </Button>
              </div>
            </form>
          </div>

          <Link
            className={buttonVariants({
              variant: "link",
              className: "gap-1.5",
            })}
            href="/sign-in"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgetPasswordForm;
