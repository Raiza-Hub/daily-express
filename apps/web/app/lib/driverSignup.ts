import { onboardingSchema } from "@repo/types";

export interface DriverSignupData {
    file?: File;
    firstName: string;
    lastName: string;
    email: string;
    country: string;
    currency: string;
    address: string;
    city: string;
    state: string;
    phoneNumber: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    kycType: "" | "bvn" | "nin";
    kycId: string;
    kycConsent: boolean;
}

export type DriverSignupKey = keyof DriverSignupData;
export type DriverStepErrors = Partial<Record<DriverSignupKey, string>>;

export const initialDriverSignupData: DriverSignupData = {
    firstName: "",
    lastName: "",
    email: "",
    country: "Nigeria",
    currency: "NGN",
    address: "",
    city: "",
    state: "",
    phoneNumber: "",
    bankName: "",
    bankCode: "",
    accountNumber: "",
    accountName: "",
    kycType: "",
    kycId: "",
    kycConsent: false,
};

export interface DriverSchemaLike {
    safeParse(data: unknown): {
        success: boolean;
        error?: {
            issues: { path: (string | number | symbol)[]; message: string }[];
        };
    };
}

export const personalInfoSchema = onboardingSchema.pick({
    file: true,
    firstName: true,
    lastName: true,
    email: true,
});

export const addressSchema = onboardingSchema.pick({
    state: true,
    city: true,
    address: true,
    phoneNumber: true,
});

export const bankSchema = onboardingSchema.pick({
    bankName: true,
    bankCode: true,
    accountNumber: true,
    accountName: true,
});

export const kycSchema = onboardingSchema.pick({
    kycType: true,
    kycId: true,
    kycConsent: true,
});

export const onboardingSchemaPick = {
    1: personalInfoSchema,
    2: addressSchema,
    3: bankSchema,
} satisfies Record<number, DriverSchemaLike>;

export function validateStep(
    schema: DriverSchemaLike,
    data: DriverSignupData,
): DriverStepErrors {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors: DriverStepErrors = {};
        for (const issue of result.error?.issues ?? []) {
            const key = issue.path[0] as DriverSignupKey;
            if (key && !errors[key]) errors[key] = issue.message;
        }
        return errors;
    }
    return {};
}

export function validatePersonal(data: DriverSignupData): DriverStepErrors {
    return validateStep(personalInfoSchema, data);
}

export function validateAddress(data: DriverSignupData): DriverStepErrors {
    return validateStep(addressSchema, data);
}

export function validateBank(data: DriverSignupData): DriverStepErrors {
    return validateStep(bankSchema, data);
}

export function validateKyc(data: DriverSignupData): DriverStepErrors {
    return validateStep(kycSchema, data);
}