"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  applyApiFieldErrors,
  getApiErrorMessage,
  useGetMe,
  useUpdateProfile,
} from "@repo/api";
import { EditProfileSchema } from "@repo/types/authSchema";
import { Button } from "@repo/ui/components/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod/v4";
import { isValidDateString } from "~/lib/utils";
import DeleteAccount from "./DeleteAccount";
import { usePostHog } from "posthog-js/react";
import { posthogEvents } from "~/lib/posthog-events";
import Loader from "../Loader";

const ProfileSchema = EditProfileSchema;
type TProfileSchema = z.infer<typeof ProfileSchema>;

const Profile = () => {
  const [profileError, setProfileError] = useState<string | null>(null);
  const { data: user, isLoading, refetch: refetchUser } = useGetMe();
  const posthog = usePostHog();

  const {
    handleSubmit,
    control,
    reset,
    setError,
    formState: { isSubmitting, isDirty },
  } = useForm<TProfileSchema>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      dateOfBirth: undefined,
    },
  });
  const { mutate: updateProfile } = useUpdateProfile({
    onSuccess: () => {
      posthog.capture(posthogEvents.driver_profile_update_succeeded);
      refetchUser();
    },
    onError: (err) => {
      applyApiFieldErrors<keyof TProfileSchema>(err, setError);
      posthog.captureException(new Error(err.message), {
        action: "update_profile",
      });
      setProfileError(getApiErrorMessage(err, "Failed to update profile"));
    },
  });

  useEffect(() => {
    if (!isLoading && user) {
      reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        dateOfBirth: new Date(user.dateOfBirth),
      });
    }
  }, [user, isLoading, reset]);

  const onSubmit = (data: TProfileSchema) => {
    updateProfile({
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
    });
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto flex items-center justify-center py-20">
        <Loader text="Loading profile..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div>
        <div className="mb-6 md:mb-8 py-4 border-b border-gray-100">
          <h1 className="text-xl font-semibold mb-1.5">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage settings for your Daily Express profile.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup className="gap-5 sm:gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
              <FieldLabel htmlFor="firstName" className="sm:pt-2.5">
                Full Name
              </FieldLabel>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Controller
                  name="firstName"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <Input
                        id="firstName"
                        {...field}
                        aria-invalid={fieldState.invalid}
                        placeholder="First name on ID"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="lastName"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <Input
                        id="lastName"
                        {...field}
                        aria-invalid={fieldState.invalid}
                        placeholder="Last name on ID"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
              <FieldLabel htmlFor="email" className="sm:pt-2.5">
                Email
              </FieldLabel>

              <Controller
                name="email"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <Input
                      {...field}
                      id="email"
                      aria-invalid={fieldState.invalid}
                      placeholder="Email"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
              <FieldLabel htmlFor="dateOfBirth" className="sm:pt-2.5">
                Date of birth
              </FieldLabel>

              <Controller
                name="dateOfBirth"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      aria-invalid={fieldState.invalid}
                      defaultValue={
                        field.value
                          ? dayjs(field.value).format("YYYY-MM-DD")
                          : ""
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && isValidDateString(val)) {
                          field.onChange(dayjs(val).toDate());
                        } else if (!val) {
                          field.onChange(undefined);
                        }
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
          </FieldGroup>

          {profileError && (
            <p className="px-1 pb-2 inline-flex justify-center text-sm text-red-500">
              {profileError}
            </p>
          )}
          <div className="mt-8 flex justify-end">
            <Button
              variant="secondary"
              type="submit"
              className="cursor-pointer"
              disabled={isSubmitting || !isDirty}
            >
              {isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>

      <DeleteAccount />
    </div>
  );
};
export default Profile;
