"use client";

import { CircleCheck, Check, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import type { DriverSignupData, DriverStepErrors } from "~/lib/driverSignup";

type BankOption = {
    name: string;
    code: string;
};

import bankNames from "../../../bank-names.json";

const KYC_TYPES = [
    { value: "bvn", label: "BVN (Bank Verification Number)" },
    { value: "nin", label: "NIN (National Identity Number)" },
] as const;

interface BankKycStepProps {
    data: DriverSignupData;
    errors: DriverStepErrors;
    onChange: (patch: Partial<DriverSignupData>) => void;
    bankVerified: boolean;
    isVerifyingBank: boolean;
    onVerifyBank: () => void;
    identityVerified: boolean;
    isVerifyingIdentity: boolean;
    onVerifyIdentity: () => void;
}

const BANKS: BankOption[] = bankNames.map((bank) => ({
    name: bank.name,
    code: bank.code,
}));

const BankKycStep = ({
    data,
    errors,
    onChange,
    bankVerified,
    isVerifyingBank,
    onVerifyBank,
    identityVerified,
    isVerifyingIdentity,
    onVerifyIdentity,
}: BankKycStepProps) => (
    <div className="flex flex-col gap-6">
        {/* Bank details */}
        <Field label="Bank" htmlFor="bankName" error={errors.bankName}>
            <Select
                id="bankName"
                value={data.bankName}
                invalid={Boolean(errors.bankName)}
                onChange={(event) => {
                    const bank = BANKS.find((option) => option.name === event.target.value);
                    onChange({ bankName: event.target.value, bankCode: bank?.code ?? "" });
                }}
            >
                <option value="" disabled>
                    Select bank
                </option>
                {BANKS.map((bank) => (
                    <option key={bank.name} value={bank.name}>
                        {bank.name}
                    </option>
                ))}
            </Select>
        </Field>

        <Field label="Account number" htmlFor="accountNumber" error={errors.accountNumber}>
            <Input
                id="accountNumber"
                inputMode="numeric"
                maxLength={10}
                value={data.accountNumber}
                onChange={(event) =>
                    onChange({ accountNumber: event.target.value })
                }
                invalid={Boolean(errors.accountNumber)}
                placeholder="0123456789"
            />
        </Field>
        <Field label="Account name" htmlFor="accountName" error={errors.accountName}>
            <Input
                id="accountName"
                value={data.accountName}
                onChange={(event) => onChange({ accountName: event.target.value })}
                invalid={Boolean(errors.accountName)}
                placeholder="Account holder name"
            />
        </Field>

        <Button
            type="button"
            pill
            className="w-full"
            onClick={onVerifyBank}
            disabled={isVerifyingBank || bankVerified}
        >
            {isVerifyingBank ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : bankVerified ? (
                <CircleCheck className="h-4 w-4" aria-hidden />
            ) : null}
            {bankVerified ? "Account verified" : "Verify account"}
        </Button>

        {bankVerified && (
            <>
                <span className="text-sm text-muted-foreground">
                    Account verified. Complete identity verification to continue.
                </span>

                {/* Identity type */}
                <fieldset className="flex flex-col">
                    <legend className="mb-3 text-sm font-medium text-foreground">
                        Identity type
                    </legend>
                    <div className="flex flex-col gap-3" role="radiogroup">
                        {KYC_TYPES.map((option) => {
                            const checked = data.kycType === option.value;
                            return (
                                <label
                                    key={option.value}
                                    className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                                >
                                    <input
                                        type="radio"
                                        name="kycType"
                                        value={option.value}
                                        checked={checked}
                                        onChange={() =>
                                            onChange({ kycType: option.value })
                                        }
                                        className="peer sr-only"
                                    />
                                    <span
                                        aria-hidden
                                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring ${
                                            checked ? "border-primary" : "border-border"
                                        }`}
                                    >
                                        <span
                                            className={`h-2 w-2 rounded-full transition-colors duration-150 ${
                                                checked ? "bg-primary" : "bg-transparent"
                                            }`}
                                        />
                                    </span>
                                    {option.label}
                                </label>
                            );
                        })}
                    </div>
                    {errors.kycType && (
                        <p className="mt-2 text-sm text-destructive">{errors.kycType}</p>
                    )}
                </fieldset>

                {/* KYC ID */}
                <Field label="KYC ID number" htmlFor="kycId" error={errors.kycId}>
                    <Input
                        id="kycId"
                        inputMode="numeric"
                        maxLength={20}
                        value={data.kycId}
                        onChange={(event) => onChange({ kycId: event.target.value })}
                        invalid={Boolean(errors.kycId)}
                        placeholder={
                            data.kycType === "nin"
                                ? "11-digit NIN"
                                : "11-digit BVN"
                        }
                    />
                </Field>

                {/* Consent */}
                <label
                    htmlFor="kycConsent"
                    className="flex cursor-pointer items-start gap-2 text-sm text-foreground"
                >
                    <input
                        id="kycConsent"
                        type="checkbox"
                        checked={data.kycConsent}
                        onChange={(event) =>
                            onChange({ kycConsent: event.target.checked })
                        }
                        className="peer sr-only"
                    />
                    <span
                        aria-hidden
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring ${
                            data.kycConsent ? "border-primary bg-primary" : "border-border"
                        }`}
                    >
                        {data.kycConsent && (
                            <Check className="h-3 w-3 text-primary-foreground" aria-hidden />
                        )}
                    </span>
                    <span>
                        I consent to identity verification to use the driver platform.
                    </span>
                </label>
                {errors.kycConsent && (
                    <p className="text-sm text-destructive">{errors.kycConsent}</p>
                )}

                <Button
                    type="button"
                    pill
                    className="w-full"
                    onClick={onVerifyIdentity}
                    disabled={isVerifyingIdentity || identityVerified || !data.kycConsent}
                >
                    {isVerifyingIdentity ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : identityVerified ? (
                        <CircleCheck className="h-4 w-4" aria-hidden />
                    ) : null}
                    {identityVerified ? "Identity verified" : "Verify identity"}
                </Button>
            </>
        )}
    </div>
);

export { BankKycStep };