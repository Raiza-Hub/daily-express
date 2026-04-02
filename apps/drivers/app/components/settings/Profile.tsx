"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SignUpSchema, TSignUpSchema } from "@repo/types/authSchema";
import { Button } from "@repo/ui/components/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import ChangePasswordDialog from "./ChangePasswordDialog";
import DeleteAccount from "./DeleteAccount";
import { z } from "zod";
import dayjs from "dayjs";
import { useGetMe, useUpdateProfile, useGetProviders } from "@repo/api";
import { toast } from "@repo/ui/components/sonner";
import { Icons } from "@repo/ui/Icons";
import DisconnectGoogleDialog from "./DisconnectGoogleDialog";

const ProfileSchema = SignUpSchema.omit({ password: true }).partial();
type TProfileSchema = z.infer<typeof ProfileSchema>;

const Profile = () => {
  const { data: user, isLoading, refetch: refetchUser } = useGetMe();
  const { data: providers, refetch: refetchProviders } = useGetProviders();

  console.log(user);
  

  const isGoogleConnected = providers?.includes("google");

  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile({
    onSuccess: () => {
      refetchUser();
      toast.success("Profile updated successfully");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const {
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<TProfileSchema>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth) : new Date(),
    },
  });

  useEffect(() => {
    if (!isLoading && user) {
      reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth) : new Date(),
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
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div>
        <div className="mb-6 py-4 border-b border-gray-100">
          <h1 className="text-xl font-semibold mb-1">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage settings for your Daily Express profile.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup className="sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
              <FieldLabel htmlFor="firstName" className="pt-2.5">
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
              <FieldLabel htmlFor="email" className="pt-2.5">
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
              <FieldLabel htmlFor="dateOfBirth" className="pt-2.5">
                Date of birth
              </FieldLabel>

              <Controller
                name="dateOfBirth"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <Input
                      {...field}
                      id="dateOfBirth"
                      type="date"
                      aria-invalid={fieldState.invalid}
                      value={
                        field.value
                          ? dayjs(field.value).format("YYYY-MM-DD")
                          : ""
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
          </FieldGroup>

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

      <div>
        <div className="mb-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold mb-1">Authentication</h2>
          <p className="text-sm text-muted-foreground">
            Manage your password and authentication settings.
          </p>
        </div>

        <div>
          <div className="flex justify-between items-center py-2 min-h-[40px]">
            <div className="flex items-center gap-3">
              <Icons.google className="w-5 h-5" />
              <span className="text-sm font-medium">Google</span>
            </div>
            {isGoogleConnected ? (
              <DisconnectGoogleDialog
                hasPassword={!!user?.hasPassword}
                onSuccess={refetchProviders}
              />
            ) : (
              <Button variant="secondary" disabled className="cursor-pointer">
                Not connected
              </Button>
            )}
          </div>
        </div>
      </div>

      <DeleteAccount />
    </div>
  );
};
export default Profile;
