import { z } from "zod"

export const onboardingSchema = z.object({
  firstName: z
    .string()
    .min(3, { error: "First name is required." })
    .max(256, { error: "First name must be at most 256 characters long." }),

  lastName: z
    .string()
    .min(3, { error: "Last name is required." })
    .max(256, { error: "Last name must be at most 256 characters long." }),

  file: z
    .instanceof(File, { error: "Image is required." })
    .optional()
    .refine((val) => val instanceof File, { message: "Image is required." }),
  
  email: z
    .email({ error: "Invalid email address" }),
  
  gender: z.enum(["male", "female"], { error: "Gender is required" }),

  country: z
    .string()
    .min(1, { error: "Country is required" }),
  
  address: z
    .string()
    .min(1, { error: "Address is required" }),

  city: z
    .string()
    .min(1, { error: "City is required" })
    .max(256, { error: "City must be at most 256 characters long." }),

  state: z
    .string()
    .min(1, { error: "State is required" }),
  
  phoneNumber: z
    .string()
    .min(11, { error: "Phone number is required" })
    .max(20),
  
  bankName: z
    .string()
    .min(1, { error: "Bank name is required" }),
  
  accountNumber: z
    .string()
    .min(1, { error: "Account number is required" })
    .max(10, {error: "Account number must be at most 10 characters long."}),
  
  accountName: z
    .string()
    .min(1, { error: "Account name is required" }),
});

export type TonboardingSchema = z.infer<typeof onboardingSchema>;