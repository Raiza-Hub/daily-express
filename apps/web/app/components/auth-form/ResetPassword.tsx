"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PasswordIcon } from "@phosphor-icons/react";
import { useResetPassword } from "@repo/api";
import {
  ResetPasswordSchema,
  TresetPasswordSchema,
} from "@repo/types/authSchema";
import { Button } from "@repo/ui/components/button";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { toast } from "@repo/ui/components/sonner";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { posthogEvents } from "~/lib/posthog-events";
import { usePostHog } from "posthog-js/react";

const ResetPasswordForm = ({ token }: { token?: string }) => {
  const router = useRouter();
  const { mutate: resetPassword, isPending, error } = useResetPassword();
  const posthog = usePostHog();

  const { handleSubmit, control } = useForm<TresetPasswordSchema>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (data: TresetPasswordSchema) => {
    if (!token) {
      toast.error("Invalid or missing reset token");
      return;
    }
    resetPassword(
      { token, password: data.newPassword },
      {
        onSuccess: () => {
          posthog.capture(posthogEvents.auth_password_reset_succeeded);
          router.push("/sign-in");
        },
        onError: (err) => {
          posthog.captureException(new Error(err.message), {
            action: "resetPassword",
          });
          // toast.error("Something went wrong");
        },
      },
    );
  };

  return (
    <div className="flex items-center justify-center p-4 pt-20">
      <div className="w-full max-w-sm bg-white">
        <div className="text-center space-y-6">
          <div className="flex flex-col items-center justify-center gap-3">
            <PasswordIcon className="w-8 h-8" />
            <h1 className="text-xl font-bold text-gray-900">
              Reset your password
            </h1>
          </div>
          <div className="max-w-prose text-sm space-y-1">
            <p className="text-zinc-500">
              Choose a strong password to keep your account safe.
            </p>
          </div>
          <div>
            <form className="w-full" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-2">
                <div className="grid gap-2 py-2">
                  <Controller
                    name="newPassword"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="newPassword">Password</FieldLabel>
                        <Input
                          {...field}
                          id="newPassword"
                          type="password"
                          aria-invalid={fieldState.invalid}
                          placeholder="Enter your new password"
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
                        <FieldLabel htmlFor="confirmPassword">
                          Confirm Password
                        </FieldLabel>
                        <Input
                          {...field}
                          id="confirmPassword"
                          type="password"
                          aria-invalid={fieldState.invalid}
                          placeholder="Re-enter your new password"
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
                  type="submit"
                  variant="submit"
                  disabled={isPending}
                  className="w-full cursor-pointer"
                >
                  Reset Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordForm;
