"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import {
    confirmProfileUploadFn,
    presignProfileUploadFn,
    uploadToR2Fn,
    useCreateDriver,
    useVerifyBank,
    useVerifyKyc,
} from "@repo/api";
import { Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { AddressInfoStep } from "~/components/driver/AddressInfoStep";
import { BankKycStep } from "~/components/driver/BankKycStep";
import { PersonalInfoStep } from "~/components/driver/PersonalInfoStep";
import {
    type DriverSignupData,
    type DriverSignupKey,
    type DriverStepErrors,
    initialDriverSignupData,
    validateAddress,
    validateBank,
    validateKyc,
    validatePersonal,
} from "~/lib/driverSignup";
import { toE164 } from "~/lib/phone";
import { makeFieldErrorMapper } from "~/lib/formErrors";

const stepTransition: Transition = { duration: 0.25, ease: "easeOut" };

function DriverSignupForm() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [data, setData] = useState<DriverSignupData>(initialDriverSignupData);
    const [errors, setErrors] = useState<DriverStepErrors>({});
    const [formError, setFormError] = useState<string | undefined>(undefined);
    const [bankVerified, setBankVerified] = useState(false);
    const [identityVerified, setIdentityVerified] = useState(false);
    const fileRef = useRef<File | undefined>(undefined);

    const mapFieldError = makeFieldErrorMapper<DriverSignupKey>(
        (name, message) =>
            setErrors((current) => ({ ...current, [name]: message })),
        setFormError,
    );

    const createDriver = useCreateDriver({
        onSuccess: () => {
            const file = fileRef.current;
            fileRef.current = undefined;
            router.push("/driver/calendar");
            if (!file) return;
            void (async () => {
                try {
                    const presign = await presignProfileUploadFn(file.type, file.size);
                    await uploadToR2Fn(presign.uploadUrl, file);
                    await confirmProfileUploadFn(presign.key);
                } catch (uploadError) {
                    console.error("driver.signup.profile_upload.failed", uploadError);
                }
            })();
        },
        onError: (error: Error) => {
            mapFieldError(error, "Something went wrong. Please try again.");
        },
    });

    const verifyBank = useVerifyBank({
        onSuccess: (result) => {
            setData((current) => ({
                ...current,
                accountName: result.accountName,
            }));
            setErrors((current) => ({
                ...current,
                accountName: undefined,
                bankCode: undefined,
                accountNumber: undefined,
            }));
            setBankVerified(true);
        },
        onError: (error: Error) => {
            mapFieldError(
                error,
                "Could not verify your bank account. Check the details and try again.",
            );
        },
    });

    const verifyKyc = useVerifyKyc({
        onSuccess: () => setIdentityVerified(true),
        onError: (error: Error) => {
            const apiError = error as { code?: string; message?: string };
            if (apiError.code === "KYC_ALREADY_USED" && apiError.message) {
                setErrors((current) => ({
                    ...current,
                    kycId: apiError.message as string,
                }));
                return;
            }
            mapFieldError(
                error,
                "Could not verify your identity. Check your details and try again.",
            );
        },
    });

    const patch = (update: Partial<DriverSignupData>) => {
        setData((current) => ({ ...current, ...update }));

        setErrors((current) => {
            const next = { ...current };
            for (const key of Object.keys(update) as DriverSignupKey[]) {
                delete next[key];
            }
            return next;
        });

        if (
            update.bankName !== undefined ||
            update.accountNumber !== undefined ||
            update.accountName !== undefined
        ) {
            setBankVerified(false);
        }

        if (
            update.kycType !== undefined ||
            update.kycId !== undefined ||
            update.kycConsent !== undefined
        ) {
            setIdentityVerified(false);
        }
    };

    const handleContinue = () => {
        const nextErrors = step === 1 ? validatePersonal(data) : validateAddress(data);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;
        setStep((current) => current + 1);
        setErrors({});
    };

    const handleVerifyBank = () => {
        const nextErrors = validateBank(data);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;
        setFormError(undefined);
        verifyBank.mutate({
            bankCode: data.bankCode,
            accountNumber: data.accountNumber,
            currency: data.currency,
        });
    };

    const handleVerifyIdentity = () => {
        const nextErrors = validateKyc(data);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;
        setFormError(undefined);
        verifyKyc.mutate({
            kycType: data.kycType as "bvn" | "nin",
            kycId: data.kycId,
        });
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (createDriver.isPending) return;
        fileRef.current = data.file;
        setFormError(undefined);
        createDriver.mutate({
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: toE164(data.phoneNumber),
            country: data.country,
            currency: data.currency,
            state: data.state,
            city: data.city,
            address: data.address,
            bankName: data.bankName,
            bankCode: data.bankCode,
            accountNumber: data.accountNumber,
            accountName: data.accountName,
            kycType: data.kycType as "bvn" | "nin",
            kycId: data.kycId,
        });
    };

    const showSubmit = step === 3 && bankVerified && identityVerified;
    const showContinue = step < 3;
    const isPending = createDriver.isPending;

    return (
        <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-6"
        >
            <AnimatePresence mode="wait" initial={false}>
                {step === 1 && (
                    <motion.div
                        key="personal"
                        initial={{ opacity: 0, x: 60 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -60 }}
                        transition={stepTransition}
                    >
                        <PersonalInfoStep data={data} errors={errors} onChange={patch} />
                    </motion.div>
                )}
                {step === 2 && (
                    <motion.div
                        key="address"
                        initial={{ opacity: 0, x: 60 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -60 }}
                        transition={stepTransition}
                    >
                        <AddressInfoStep data={data} errors={errors} onChange={patch} />
                    </motion.div>
                )}
                {step === 3 && (
                    <motion.div
                        key="bank"
                        initial={{ opacity: 0, x: 60 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -60 }}
                        transition={stepTransition}
                    >
                        <BankKycStep
                            data={data}
                            errors={errors}
                            onChange={patch}
                            bankVerified={bankVerified}
                            isVerifyingBank={verifyBank.isPending}
                            onVerifyBank={handleVerifyBank}
                            identityVerified={identityVerified}
                            isVerifyingIdentity={verifyKyc.isPending}
                            onVerifyIdentity={handleVerifyIdentity}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-col gap-3 pt-2">
                {formError && (
                    <p role="alert" className="text-center text-sm text-destructive">
                        {formError}
                    </p>
                )}
                <div className="flex gap-3">
                    {step > 1 && (
                        <Button
                            type="button"
                            variant="outline"
                            pill
                            className="flex-1 font-semibold text-sm"
                            onClick={() => setStep((current) => current - 1)}
                        >
                            Back
                        </Button>
                    )}
                    {showSubmit && (
                        <Button
                            type="submit"
                            pill
                            className="flex-1 font-semibold text-sm"
                            disabled={isPending}
                        >
                            {isPending && (
                                <Loader2
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden
                                />
                            )}
                            Create account
                        </Button>
                    )}
                    {showContinue && (
                        <Button
                            type="button"
                            pill
                            className="flex-1 font-semibold text-sm"
                            onClick={handleContinue}
                        >
                            Continue
                        </Button>
                    )}
                </div>
            </div>
        </form>
    );
}

export { DriverSignupForm };