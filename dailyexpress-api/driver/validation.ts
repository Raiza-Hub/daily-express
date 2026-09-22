import z from "zod";
import { KORA_SUPPORTED_COUNTRIES } from "@shared/constants";

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

const requiredString = (field: string, min: number, max: number) =>
  z
    .string({ error: `${field} is required` })
    .min(min, {
      error: (issue) =>
        typeof issue.input === "string" && issue.input.length === 0
          ? `${field} is required`
          : `${field} must be at least ${min} characters long`,
    })
    .max(max, `${field} must not exceed ${max} characters`);

export const createDriverSchema = z.object({
  firstName: requiredString("First name", 1, 50),
  lastName: requiredString("Last name", 1, 50),
  email: z
    .string({ error: "Email is required" })
    .min(1, "Email is required")
    .pipe(z.email("Please provide a valid email address")),
  profile_pic: z.string().optional(),
  phone: z
    .string({ error: "Phone number is required" })
    .regex(phoneRegex, {
      error: (issue) =>
        typeof issue.input === "string" && issue.input.length === 0
          ? "Phone number is required"
          : "Phone number must be a valid international format",
    }),
  country: z
    .string({ error: "Country is required" })
    .min(1, "Country is required")
    .pipe(z.enum(KORA_SUPPORTED_COUNTRIES, "This country is not supported at the moment")),
  currency: z
    .string({ error: "Currency is required" })
    .min(2, {
      error: (issue) =>
        typeof issue.input === "string" && issue.input.length === 0
          ? "Currency is required"
          : "must be at least 2 characters long",
    })
    .max(3),
  state: requiredString("State", 2, 100),
  city: requiredString("City", 2, 100),
  address: requiredString("Address", 1, 200),
});

export const updateDriverSchema = z
  .object({
    firstName: z.string().min(1, "First name must be at least 1 character long").max(50, "First name must not exceed 50 characters").optional(),
    lastName: z.string().min(1, "Last name must be at least 1 character long").max(50, "Last name must not exceed 50 characters").optional(),
    email: z.string().pipe(z.email("Please provide a valid email address")).optional(),
    phone: z.string().regex(phoneRegex, "Phone number must be a valid international format").optional(),
    profile_pic: z.string().optional(),
    country: z.enum(KORA_SUPPORTED_COUNTRIES, "This country is not supported at the moment").optional(),
    currency: z.string().min(2).max(3).optional(),
    state: z.string().min(2).max(100).optional(),
    city: z.string().min(2).max(100).optional(),
    address: z.string().min(1).max(200).optional(),
    bankName: z.string().min(2).max(100).optional(),
    bankCode: z.string().min(2).max(20).optional(),
    accountNumber: z.string().min(2).max(100).optional(),
    accountName: z.string().min(2).max(100).optional(),
    kycType: z.enum(["bvn", "nin"], { error: "KYC type must be either 'bvn' or 'nin'" }).optional(),
    kycId: z.string().regex(/^\d{11}$/, "KYC ID must be exactly 11 digits").optional(),
    kycConsent: z.literal(true, { error: "You must consent to identity verification" }).optional(),
  })
  .refine((value) => Object.keys(value).length >= 1, {
    message: "must contain at least 1 keys",
    path: ["request"],
  });