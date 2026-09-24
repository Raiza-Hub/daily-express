import z from "zod";

export const MINIMUM_ACCOUNT_AGE = 14;

export const ONBOARDING_PHONE_REGEX = /^\+234[789]\d{9}$/;
export const ONBOARDING_GENDERS = ["male", "female"] as const;

export function isUnder14(dateOfBirth: Date): boolean {
  const today = new Date();
  const threshold = new Date(
    today.getFullYear() - MINIMUM_ACCOUNT_AGE,
    today.getMonth(),
    today.getDate(),
  );
  return dateOfBirth > threshold;
}

const dateOfBirth = () =>
  z
    .coerce.date({ error: "must be a valid date" })
    .refine(
      (value) => !isUnder14(value),
      `You must be at least ${MINIMUM_ACCOUNT_AGE} years old`,
    );

const phoneNumber = () =>
  z
    .string({ error: "Phone number is required" })
    .regex(
      ONBOARDING_PHONE_REGEX,
      "Enter a valid Nigerian phone number in international format (e.g. +2348012345678)",
    );

export const completeOnboardingSchema = z
  .object({
    phoneNumber: phoneNumber(),
    dateOfBirth: dateOfBirth().optional(),
    gender: z
      .string({ error: "Gender is required" })
      .pipe(z.enum(ONBOARDING_GENDERS, "Please select your gender")),
  })
  .superRefine((value, ctx) => {
    if (value.dateOfBirth === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Date of birth is required",
      });
    }
  });

export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name must not exceed 50 characters")
    .optional(),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name must not exceed 50 characters")
    .optional(),
  dateOfBirth: dateOfBirth().optional(),
  phoneNumber: phoneNumber().optional(),
  gender: z
    .enum(ONBOARDING_GENDERS, "Please select your gender")
    .optional(),
});