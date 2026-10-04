"use client";

import { CircleCheck, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { RadioGroup } from "~/components/ui/radio-group";
import { Select } from "~/components/ui/select";
import type { DriverSignupData } from "~/lib/driverSignup";

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
    onChange: (patch: Partial<DriverSignupData>) => void;
    bankVerified: boolean;
    isVerifyingBank: boolean;
    onVerifyBank: () => void;
    identityVerified: boolean;
    isVerifyingIdentity: boolean;
    onVerifyIdentity: () => void;
    formError?: string;
}

const BANKS: BankOption[] = bankNames.map((bank) => ({
    name: bank.name,
    code: bank.code,
}));

const FormError = ({ message }: { message?: string }) =>
    message ? (
        <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
            {message}
        </p>
    ) : null;

interface IdentitySectionProps {
    data: DriverSignupData;
    onChange: (patch: Partial<DriverSignupData>) => void;
    identityVerified: boolean;
    isVerifyingIdentity: boolean;
    onVerifyIdentity: () => void;
    formError?: string;
}

const IdentitySection = ({
    data,
    onChange,
    identityVerified,
    isVerifyingIdentity,
    onVerifyIdentity,
    formError,
}: IdentitySectionProps) => (
    <>
        <span className="text-sm text-muted-foreground">
            Account verified. Complete identity verification to continue.
        </span>

        {/* Identity type */}
        <RadioGroup
            name="kycType"
            legend="Identity type"
            options={KYC_TYPES.map((option) => ({
                value: option.value,
                label: option.label,
            }))}
            value={data.kycType}
            onValueChange={(value) => onChange({ kycType: value })}
        />

        {/* KYC ID */}
        <Field label="KYC ID number" name="kycId">
            <Input
                id="kycId"
                inputMode="numeric"
                maxLength={11}
                value={data.kycId}
                onChange={(event) => onChange({ kycId: event.target.value })}
                placeholder={
                    data.kycType === "nin"
                        ? "11-digit NIN"
                        : "11-digit BVN"
                }
            />
        </Field>

        {/* Consent */}
        <Checkbox
            name="kycConsent"
            checked={data.kycConsent}
            onCheckedChange={(checked) => onChange({ kycConsent: checked })}
        >
            I consent to identity verification to use the driver platform.
        </Checkbox>

        <FormError message={formError} />

        <Button
            type="button"
            pill
            className="w-full font-semibold text-sm"
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
);

const BankKycStep = ({
    data,
    onChange,
    bankVerified,
    isVerifyingBank,
    onVerifyBank,
    identityVerified,
    isVerifyingIdentity,
    onVerifyIdentity,
    formError,
}: BankKycStepProps) => (
    <div className="flex flex-col gap-6">
        {/* Bank details */}
        <Field label="Bank" name="bankName">
            <Select
                id="bankName"
                value={data.bankName}
                onChange={(value) => {
                    const bank = BANKS.find((option) => option.name === value);
                    onChange({ bankName: value, bankCode: bank?.code ?? "" });
                }}
                placeholder="Select bank"
                items={[
                    { value: "", label: "Select bank", disabled: true },
                    ...BANKS.map((bank) => ({
                        value: bank.name,
                        label: bank.name,
                    })),
                ]}
            />
        </Field>

        <Field label="Account number" name="accountNumber">
            <Input
                id="accountNumber"
                inputMode="numeric"
                maxLength={10}
                value={data.accountNumber}
                onChange={(event) =>
                    onChange({ accountNumber: event.target.value })
                }
                placeholder="0123456789"
            />
        </Field>
        <Field label="Account name" name="accountName">
            <Input
                id="accountName"
                value={data.accountName}
                onChange={(event) => onChange({ accountName: event.target.value })}
                placeholder="Account holder name"
            />
        </Field>

        <FormError message={bankVerified ? undefined : formError} />

        <Button
            type="button"
            pill
            className="w-full font-semibold text-sm"
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
            <IdentitySection
                data={data}
                onChange={onChange}
                identityVerified={identityVerified}
                isVerifyingIdentity={isVerifyingIdentity}
                onVerifyIdentity={onVerifyIdentity}
                formError={formError}
            />
        )}
    </div>
);

export { BankKycStep };