"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CompleteOnboardingSchema,
  TCompleteOnboardingSchema,
} from "@repo/types/authSchema";
import {
  applyApiFieldErrors,
  getApiErrorMessage,
  useCompleteOnboarding,
} from "@repo/api";
import { Button } from "@repo/ui/components/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { isValidDateString } from "~/lib/utils";

const OnboardingForm = () => {
  const router = useRouter();
  const { mutate: completeOnboarding, isPending } = useCompleteOnboarding({
    onSuccess: () => {
      router.push("/");
    },
    onError: (err) => {
      applyApiFieldErrors<keyof TCompleteOnboardingSchema>(err, setError);
      setError("root", {
        message: getApiErrorMessage(err, "Something went wrong"),
      });
    },
  });

  const {
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<TCompleteOnboardingSchema>({
    resolver: zodResolver(CompleteOnboardingSchema),
    defaultValues: {
      phoneNumber: "",
      dateOfBirth: undefined,
      gender: undefined,
    },
  });

  const onSubmit = (data: TCompleteOnboardingSchema) => {
    completeOnboarding({
      phoneNumber: data.phoneNumber,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup className="gap-4">
        <Controller
          name="phoneNumber"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="phoneNumber">
                Phone number
              </FieldLabel>
              <Input
                {...field}
                id="phoneNumber"
                aria-invalid={fieldState.invalid}
                placeholder="+2348012345678"
                inputMode="tel"
                autoComplete="tel"
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        <Controller
          name="dateOfBirth"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="dateOfBirth">Date of birth</FieldLabel>
              <Input
                id="dateOfBirth"
                type="date"
                aria-invalid={fieldState.invalid}
                defaultValue={
                  field.value ? dayjs(field.value).format("YYYY-MM-DD") : ""
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

        <Controller
          name="gender"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="gender">Gender</FieldLabel>
              <Select
                value={field.value}
                onValueChange={(value) =>
                  field.onChange(value as "male" | "female")
                }
              >
                <SelectTrigger
                  id="gender"
                  aria-invalid={fieldState.invalid}
                  className="w-full"
                >
                  <SelectValue placeholder="Select your gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
      </FieldGroup>

      {errors.root && (
        <p className="px-1 mt-2 text-center text-sm text-red-500">
          {errors.root.message}
        </p>
      )}

      <div className="mt-8">
        <Button
          variant="submit"
          type="submit"
          className="w-full cursor-pointer"
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Continue"}
        </Button>
      </div>
    </form>
  );
};

export default OnboardingForm;