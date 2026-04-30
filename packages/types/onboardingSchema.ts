import { z } from "zod";

export const onboardingSchema = z.object({
  firstName: z
    .string()
    .min(3, { error: "First name is required." })
    .max(256, { error: "First name must be at most 256 characters long." }),

  lastName: z
    .string()
    .min(3, { error: "Last name is required." })
    .max(256, { error: "Last name must be at most 256 characters long." }),

  file: z.file({ error: "Profile photo is required." }),

  email: z.email({ error: "Enter a valid email address" }),

  country: z.string().min(1, { error: "Please select your country" }),

  currency: z.string().min(1, { error: "Currency is required" }),

  address: z.string().min(1, { error: "Address is required" }),

  city: z
    .string()
    .min(1, { error: "City is required" })
    .max(256, { error: "City must be at most 256 characters long." }),

  state: z.string().min(1, { error: "State is required" }),

  phoneNumber: z
    .string()
    .min(11, { error: "Phone number is required" })
    .max(20),

  bankName: z.string().min(1, { error: "Bank name is required" }),

  bankCode: z.string().optional(),

  accountNumber: z
    .string()
    .min(7, { error: "Account number is required" })
    .max(20, { error: "Account number must be at most 20 digits long." }),

  accountName: z.string().min(1, { error: "Account name is required" }),
});

export type TonboardingSchema = z.infer<typeof onboardingSchema>;
