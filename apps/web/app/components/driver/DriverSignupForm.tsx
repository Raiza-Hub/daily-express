"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion, type Transition } from "framer-motion";
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

const stepTransition: Transition = { duration: 0.25, ease: "easeOut" };

function DriverSignupForm() {
    const [step, setStep] = useState(1);
    const [data, setData] = useState<DriverSignupData>(initialDriverSignupData);
    const [errors, setErrors] = useState<DriverStepErrors>({});
    const [bankVerified, setBankVerified] = useState(false);
    const [identityVerified, setIdentityVerified] = useState(false);
    const [isVerifyingBank, setIsVerifyingBank] = useState(false);
    const [isVerifyingIdentity, setIsVerifyingIdentity] = useState(false);

    const patch = useCallback((update: Partial<DriverSignupData>) => {
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
    }, []);

    const handleContinue = useCallback(() => {
        const nextErrors = step === 1 ? validatePersonal(data) : validateAddress(data);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;
        setStep((current) => current + 1);
        setErrors({});
    }, [step, data]);

    const handleVerifyBank = useCallback(() => {
        const nextErrors = validateBank(data);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;
        setIsVerifyingBank(true);
        window.setTimeout(() => {
            setBankVerified(true);
            setIsVerifyingBank(false);
        }, 1200);
    }, [data]);

    const handleVerifyIdentity = useCallback(() => {
        const nextErrors = validateKyc(data);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;
        setIsVerifyingIdentity(true);
        window.setTimeout(() => {
            setIdentityVerified(true);
            setIsVerifyingIdentity(false);
        }, 1200);
    }, [data]);

    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (step !== 3) {
                handleContinue();
                return;
            }
            console.log({
                file: data.file?.name ?? null,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                country: data.country,
                currency: data.currency,
                address: data.address,
                city: data.city,
                state: data.state,
                phoneNumber: toE164(data.phoneNumber),
                bankName: data.bankName,
                bankCode: data.bankCode,
                accountNumber: data.accountNumber,
                accountName: data.accountName,
                kycType: data.kycType,
                kycId: data.kycId,
                kycConsent: data.kycConsent,
            });
        },
        [step, data, handleContinue],
    );

    const showSubmit = step === 3 && bankVerified && identityVerified;
    const showContinue = step < 3;

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
                            isVerifyingBank={isVerifyingBank}
                            onVerifyBank={handleVerifyBank}
                            identityVerified={identityVerified}
                            isVerifyingIdentity={isVerifyingIdentity}
                            onVerifyIdentity={handleVerifyIdentity}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-col gap-3 pt-2">
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
                        <Button type="submit" pill className="flex-1 font-semibold text-sm">
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