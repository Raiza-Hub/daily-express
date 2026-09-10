import { z } from "zod/v4";

export const PHONE_NUMBER_REGEX = /^\+234[789]\d{9}$/;

export const MINIMUM_ACCOUNT_AGE = 14;

function isUnderAge(dateOfBirth: Date, minimumAge: number): boolean {
  const today = new Date();
  const cutoff = new Date(
    today.getFullYear() - minimumAge,
    today.getMonth(),
    today.getDate(),
  );
  return dateOfBirth > cutoff;
}

export const dateOfBirthField = z
  .date({ error: "Date of birth is required" })
  .refine((date) => date < new Date(), {
    message: "Date of birth must be in the past",
  })
  .refine((date) => !isUnderAge(date, MINIMUM_ACCOUNT_AGE), {
    message: `You must be at least ${MINIMUM_ACCOUNT_AGE} years old`,
  });

export const CompleteOnboardingSchema = z.object({
  phoneNumber: z
    .string()
    .regex(
      PHONE_NUMBER_REGEX,
      "Enter a valid Nigerian phone number in international format (e.g. +2348012345678)",
    ),
  dateOfBirth: dateOfBirthField,
  gender: z.enum(["male", "female"], { error: "Please select your gender" }),
});

export type TCompleteOnboardingSchema = z.infer<
  typeof CompleteOnboardingSchema
>;

export const EditProfileSchema = z
  .object({
    firstName: z
      .string()
      .min(3, { error: "First name is required." })
      .max(256, { error: "First name must be at most 256 characters long." }),
    lastName: z
      .string()
      .min(3, { error: "Last name is required." })
      .max(256, { error: "Last name must be at most 256 characters long." }),
    email: z.string().email({ error: "Invalid email address" }),
    dateOfBirth: dateOfBirthField,
    phoneNumber: z.string().regex(PHONE_NUMBER_REGEX).optional(),
    gender: z.enum(["male", "female"]).optional(),
  })
  .partial();

export type TEditProfileSchema = z.infer<typeof EditProfileSchema>;