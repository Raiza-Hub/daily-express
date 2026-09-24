import { z } from "zod";
import { MINIMUM_ACCOUNT_AGE, PHONE_NUMBER_REGEX } from "./authSchema";

function isUnderAge(dateOfBirth: Date, minimumAge: number): boolean {
  const today = new Date();
  const cutoff = new Date(
    today.getFullYear() - minimumAge,
    today.getMonth(),
    today.getDate(),
  );
  return dateOfBirth > cutoff;
}

export const ProfileEditSchema = z.object({
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
  phoneNumber: z
    .string()
    .regex(
      PHONE_NUMBER_REGEX,
      "Enter a valid Nigerian phone number in international format (e.g. +2348012345678)",
    )
    .optional(),
  gender: z
    .enum(["male", "female"], "Please select your gender")
    .optional(),
  dateOfBirth: z
    .date({ error: "must be a valid date" })
    .refine((date) => date < new Date(), {
      message: "Date of birth must be in the past",
    })
    .refine((date) => !isUnderAge(date, MINIMUM_ACCOUNT_AGE), {
      message: `You must be at least ${MINIMUM_ACCOUNT_AGE} years old`,
    })
    .optional(),
});

export type TProfileEditSchema = z.infer<typeof ProfileEditSchema>;

const driverPhoneRegex = /^\+?[1-9]\d{1,14}$/;

export const DriverEditSchema = z.object({
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
  email: z.email("Please provide a valid email address").optional(),
  phone: z
    .string()
    .regex(driverPhoneRegex, "Phone number must be a valid international format")
    .optional(),
  profile_pic: z.string().optional(),
  country: z.string().min(1, "Please select your country").optional(),
  currency: z.string().min(2).max(3).optional(),
  state: z.string().min(2, "Please select your state").max(100).optional(),
  city: z.string().min(2, "Please select your city").max(100).optional(),
  address: z
    .string()
    .min(1, "Address is required")
    .max(200, "Address must not exceed 200 characters")
    .optional(),
  bankName: z.string().min(2, "Please select your bank").max(100).optional(),
  bankCode: z.string().min(2, "Bank code is required").max(20).optional(),
  accountNumber: z.string().min(2, "Account number is required").max(100).optional(),
  accountName: z.string().min(2, "Account name is required").max(100).optional(),
  kycType: z
    .enum(["bvn", "nin"], "KYC type must be either 'bvn' or 'nin'")
    .optional(),
  kycId: z
    .string()
    .regex(/^\d{11}$/, "KYC ID must be exactly 11 digits")
    .optional(),
  kycConsent: z
    .literal(true, "You must consent to identity verification")
    .optional(),
});

export type TDriverEditSchema = z.infer<typeof DriverEditSchema>;

export function zodFieldErrors<T>(
  schema: z.ZodType<T>,
  value: unknown,
): Record<string, string> | null {
  const result = schema.safeParse(value);
  if (result.success) {
    return null;
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && errors[key] === undefined) {
      errors[key] = issue.message;
    }
  }
  return errors;
}