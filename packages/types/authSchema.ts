import { z } from "zod"

export const SignUpSchema = z.object({
    firstName: z
        .string()
        .min(3, { error: "First name is required." })
        .max(256, { error: "First name must be at most 256 characters long." }),

    lastName: z
        .string()
        .min(3, { error: "Last name is required." })
        .max(256, { error: "Last name must be at most 256 characters long." }),

    email: z
        .email({ error: "Invalid email address" }),
    
    password: z
        .string()
        .min(8, "Password must be at least 8 characters"),
    
    dateOfBirth: z.date({
        error: "Date of birth is required",
    })
    .refine((date) => date < new Date(), {
        message: "Date of birth must be in the past",
    })
});

export const SignInSchema = z.object({
  email: z.email({
    error: "Email is required",
  }),
  password: z.string().min(8, {
    error: "Password is required",
  }),
});

export const OtpSchema = z
    .string()
    .regex(/^\d{6}$/, "OTP must be exactly 6 digits");
  
export const ForgetPasswordSchema = z.object({
    email: z.email({ error: "Email is required" })
});

export const ResetPasswordSchema = z.object({
    // email: z.email({ error: "Email is required" }),

    newPassword: z
      .string()
      .min(8, { error: "Password is required" }),
    
    confirmPassword: z.string(),

    // otp: z
    //   .string()
    //   .regex(/^\d{6}$/, "OTP must be exactly 6 digits")
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
});

export const changePasswordSchema = z.object({
    oldPassword: z.string().min(8, "Old password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
});



export type TChangePasswordSchema = z.infer<typeof changePasswordSchema>;
export type TSignUpSchema = z.infer<typeof SignUpSchema>
export type TSignInSchema = z.infer<typeof SignInSchema>;
export type TForgetPasswordSchema = z.infer<typeof ForgetPasswordSchema>
export type TresetPasswordSchema = z.infer<typeof ResetPasswordSchema>
