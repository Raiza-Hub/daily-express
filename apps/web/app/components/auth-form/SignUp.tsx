"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleNotchIcon, EyeClosedIcon, EyeIcon } from "@phosphor-icons/react";
import { SignUpSchema, TSignUpSchema } from "@repo/types/authSchema";
import { useRegister } from "@repo/api";
import { Button } from "@repo/ui/components/button";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "@repo/ui/components/sonner";
import GoogleSignInButton from "./GoogleSignInButton";

const SignUpForm = () => {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const { mutate: register, isPending, error } = useRegister();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    handleSubmit,
    control,
    setError,
  } = useForm<TSignUpSchema>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      dateOfBirth: undefined,
      password: "",
    },
  });

  const onSubmit = (data: TSignUpSchema) => {
    register(
      {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        dateOfBirth: data.dateOfBirth,
      },
      {
        onSuccess: () => {
          router.push("/verify-email");
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

  const toggleVisibility = () => setIsVisible((prev) => !prev);

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-2">
          <div className="grid gap-2 py-2">
            <Controller
              name="firstName"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="firstName">First Name</FieldLabel>
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
                  <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
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
                  <FieldLabel htmlFor="dateOfBirth">Date of Birth</FieldLabel>
                  <Input
                    {...field}
                    id="dateOfBirth"
                    type="date"
                    aria-invalid={fieldState.invalid}
                    value={
                      field.value ? dayjs(field.value).format("YYYY-MM-DD") : ""
                    }
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          ? dayjs(e.target.value).toDate()
                          : undefined,
                      )
                    }
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
                  <FieldLabel htmlFor="password">Password</FieldLabel>
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
            <GoogleSignInButton
              disabled={isPending || isGoogleLoading}
              onClick={() => setIsGoogleLoading(true)}
            />
          </div>

          {/* {error && (
            <p className="px-1 inline-flex justify-center text-sm text-red-500">
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
              "Sign up"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SignUpForm;
