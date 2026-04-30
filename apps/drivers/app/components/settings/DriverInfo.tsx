"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useGetDriver, useUpdateDriver } from "@repo/api";
import { onboardingSchema } from "@repo/types/index";
import { Button } from "@repo/ui/components/button";
import { FieldGroup } from "@repo/ui/components/field";
import { toast } from "@repo/ui/components/sonner";
import { useFileUpload } from "@repo/ui/hooks/use-file-upload";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import "react-phone-number-input/style.css";
import { z } from "zod";
import CountryList from "../../../country-list.json";
import {
  CountryField,
  FullNameFields,
  PhoneField,
  ProfileImageField,
  StateField,
  TextFieldRow,
} from "../FormField";
import DeleteDriverAccount from "./DeleteDriverAccount";
import { posthogEvents } from "~/lib/posthog-events";
import { usePostHog } from "posthog-js/react";
import Loader from "../Loader";

const DriverInfoSchema = onboardingSchema
  .extend({
    file: z
      .union([z.instanceof(File), z.string()])
      .optional()
      .nullable(),
  })
  .omit({
    bankName: true,
    bankCode: true,
    accountNumber: true,
    accountName: true,
  });

type TDriverInfoSchema = z.infer<typeof DriverInfoSchema>;

const DriverInfo = () => {
  const [openCountry, setOpenCountry] = useState(false);
  const [openState, setOpenState] = useState(false);
  const posthog = usePostHog();

  const { data: driver, isLoading, refetch } = useGetDriver();
  const { mutate: updateDriver, isPending: isUpdating } = useUpdateDriver({
    onSuccess: () => {
      posthog.capture(posthogEvents.driver_profile_update_succeeded);
      refetch();
      toast.success("Profile updated successfully!");
    },
    onError: (error: Error) => {
      posthog.captureException(error, {
        action: "driver_profile_update_failed",
      });
      toast.error("Failed to update profile");
    },
  });

  const [{ isDragging, files }, uploadActions] = useFileUpload({
    onFilesChange: (nextFiles) => {
      const file = nextFiles?.[0]?.file;

      if (file instanceof File) {
        setValue("file", file, {
          shouldValidate: true,
          shouldDirty: true,
        });
        return;
      }

      if (file) {
        setValue("file", file.url, {
          shouldValidate: true,
          shouldDirty: true,
        });
        return;
      }

      setValue("file", driver?.profile_pic || null, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    accept: "image/*",
    multiple: false,
  });

  const {
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<TDriverInfoSchema>({
    resolver: zodResolver(DriverInfoSchema),
    defaultValues: {
      firstName: driver?.firstName || "",
      lastName: driver?.lastName || "",
      file: driver?.profile_pic,
      email: driver?.email || "",
      country: driver?.country || "",
      address: driver?.address || "",
      city: driver?.city || "",
      state: driver?.state || "",
      phoneNumber: driver?.phone || "",
    },
  });

  useEffect(() => {
    if (!isLoading && driver) {
      reset({
        firstName: driver.firstName,
        lastName: driver.lastName,
        file: driver.profile_pic,
        email: driver.email,
        country: driver.country,
        address: driver.address,
        city: driver.city,
        state: driver.state,
        phoneNumber: driver.phone,
      });
    }
  }, [driver, isLoading, reset]);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center py-20">
        <Loader text="Loading driver profile..." />
      </div>
    );
  }

  const selectedCountry = watch("country");
  const selectedState = watch("state");
  const countries = CountryList.data;
  const states =
    countries.find((country) => country.name === selectedCountry)?.states || [];
  const currentFile = files[0] || null;

  const onSubmit = (data: TDriverInfoSchema) => {
    const formData = new FormData();

    if (data.file instanceof File) {
      formData.append("file", data.file);
    }

    formData.append("firstName", data.firstName);
    formData.append("lastName", data.lastName);
    formData.append("email", data.email);
    formData.append("phone", data.phoneNumber);
    formData.append("address", data.address || "");
    formData.append("country", data.country);
    formData.append("state", data.state);
    formData.append("city", data.city);

    updateDriver(formData);
  };

  return (
    <div>
      <div className="mb-6 border-b border-gray-100 py-4">
        <h1 className="mb-1 text-xl font-semibold">Driver Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your personal details and account information.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup className="sm:space-y-6">
          <ProfileImageField
            control={control}
            currentFile={currentFile}
            driver={driver}
            isDragging={isDragging}
            errors={errors}
            uploadActions={uploadActions}
            setValue={setValue}
          />
          <FullNameFields control={control} />
          <TextFieldRow
            control={control}
            name="email"
            label="Email"
            placeholder="Email"
            type="email"
          />
          <CountryField
            control={control}
            open={openCountry}
            onOpenChange={setOpenCountry}
            errors={errors}
            selectedCountry={selectedCountry}
            countries={countries}
            setValue={setValue}
          />
          <StateField
            control={control}
            open={openState}
            onOpenChange={setOpenState}
            errors={errors}
            selectedCountry={selectedCountry}
            selectedState={selectedState}
            states={states}
            setValue={setValue}
          />
          <TextFieldRow
            control={control}
            name="city"
            label="Local Government Area (LGA)"
            placeholder="LGA"
          />
          <TextFieldRow
            control={control}
            name="address"
            label="Residential Address"
            placeholder="e.g. 12 Allen Avenue, Ikeja"
          />
          <PhoneField control={control} errors={errors} />
        </FieldGroup>

        <div className="mt-8 flex justify-end">
          <Button
            variant="secondary"
            type="submit"
            className="cursor-pointer"
            disabled={isSubmitting || isUpdating || !isDirty}
          >
            Save Changes
          </Button>
        </div>
      </form>

      <DeleteDriverAccount />
    </div>
  );
};

export default DriverInfo;
