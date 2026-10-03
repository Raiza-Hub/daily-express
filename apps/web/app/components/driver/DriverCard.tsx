"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import {
    getApiErrorMessage,
    useGetDriver,
    useUpdateDriver,
} from "@repo/api";
import { DriverEditSchema, zodFieldErrors } from "@repo/types";
import { Button } from "~/components/ui/button";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@repo/ui/Drawer";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import { Row, EditLink, getInitials } from "../user/settings-shared";
import { NIGERIAN_STATES } from "~/lib/driverData";
import { formatPhoneDisplay, PHONE_PLACEHOLDER, toE164 } from "~/lib/phone";
import { createDraftUpdater } from "~/lib/draftFields";
import { KORA_SUPPORTED_COUNTRIES } from "@shared/constants";
import { DriverProfileUnavailable } from "./DriverProfileUnavailable";
import { DriverPhotoRow } from "./DriverPhotoRow";

import bankNames from "../../../bank-names.json";

const BANKS = bankNames.map((bank) => ({
    name: bank.name,
    code: bank.code,
}));

function VerifiedCheck({ className = "fill-blue-500" }: { className?: string }) {
    return <BadgeCheck className={`h-4 w-4 shrink-0 ${className} text-white`} />;
}

function BankStatus({ status }: { status: "active" | "failed" | null }) {
    if (status === "active") {
        return (
            <span className="flex items-center gap-1 text-xs font-medium text-blue-600">
                <VerifiedCheck />
                Bank verified
            </span>
        );
    }
    if (status === "failed") {
        return <span className="text-xs font-medium text-destructive">Verification failed</span>;
    }
    return null;
}

function KycStatus({ status, kycType }: { status: "active" | "failed" | null; kycType?: string | null }) {
    if (status === "active") {
        return (
            <span className="flex items-center gap-1 text-xs font-medium text-blue-600">
                <VerifiedCheck />
                {(kycType ?? "Identity").toUpperCase()} · Verified
            </span>
        );
    }
    if (status === "failed") {
        return <span className="text-xs font-medium text-destructive">Verification failed</span>;
    }
    return <span className="text-sm text-muted-foreground">Not verified</span>;
}

const DriverCard = () => {
    const { data, isPending, isError, error } = useGetDriver();

    // --- Personal details ---

    const [isPersonalOpen, setIsPersonalOpen] = useState(false);
    const [personalDraft, setPersonalDraft] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
    });

    const openPersonal = () => {
        if (!data) return;
        setPersonalErrors({});
        setPersonalDraft({
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: formatPhoneDisplay(data.phone ?? ""),
        });
        setIsPersonalOpen(true);
    };

    // --- Address details ---

    const [isAddressOpen, setIsAddressOpen] = useState(false);
    const [addressDraft, setAddressDraft] = useState({
        country: "",
        currency: "",
        state: "",
        city: "",
        address: "",
    });

    const openAddress = () => {
        if (!data) return;
        setAddressErrors({});
        setAddressDraft({
            country: data.country,
            currency: data.currency,
            state: data.state,
            city: data.city,
            address: data.address,
        });
        setIsAddressOpen(true);
    };

    const addressStateCities =
        NIGERIAN_STATES.find((state) => state.name === addressDraft.state)?.cities ?? [];

    // --- Bank details ---

    const [isBankOpen, setIsBankOpen] = useState(false);
    const [bankDraft, setBankDraft] = useState({
        bankName: "",
        bankCode: "",
        accountNumber: "",
        accountName: "",
    });

    const openBank = () => {
        if (!data) return;
        setBankErrors({});
        setBankDraft({
            bankName: data.bankName ?? "",
            bankCode: data.bankCode ?? "",
            accountNumber: data.accountNumber ?? "",
            accountName: data.accountName ?? "",
        });
        setIsBankOpen(true);
    };

    const updateDriver = useUpdateDriver({
        onSuccess: () => {
            setIsPersonalOpen(false);
            setIsAddressOpen(false);
            setIsBankOpen(false);
            setPersonalErrors({});
            setAddressErrors({});
            setBankErrors({});
        },
    });

    // --- Drawer validation + save ---

    const [personalErrors, setPersonalErrors] = useState<Record<string, string>>({});
    const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
    const [bankErrors, setBankErrors] = useState<Record<string, string>>({});

    const validateDrawer = (
        schema: typeof DriverEditSchema,
        payload: Record<string, unknown>,
        setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    ): boolean => {
        const fieldErrors = zodFieldErrors(schema, payload);
        if (fieldErrors) {
            setErrors(fieldErrors);
            return false;
        }
        setErrors({});
        return true;
    };

    const updatePersonalDraft = createDraftUpdater(setPersonalDraft, setPersonalErrors);
    const updateAddressDraft = createDraftUpdater(setAddressDraft, setAddressErrors);
    const updateBankDraft = createDraftUpdater(setBankDraft, setBankErrors);

    const handleSavePersonal = () => {
        const payload = {
            firstName: personalDraft.firstName.trim(),
            lastName: personalDraft.lastName.trim(),
            email: personalDraft.email.trim(),
            phone: toE164(personalDraft.phone),
        };
        if (!validateDrawer(DriverEditSchema, payload, setPersonalErrors)) return;
        updateDriver.mutate(payload);
    };

    const handleSaveAddress = () => {
        const payload = {
            country: addressDraft.country,
            currency: addressDraft.currency,
            state: addressDraft.state,
            city: addressDraft.city,
            address: addressDraft.address.trim(),
        };
        if (!validateDrawer(DriverEditSchema, payload, setAddressErrors)) return;
        updateDriver.mutate(payload);
    };

    const handleSaveBank = () => {
        const payload = {
            bankName: bankDraft.bankName,
            bankCode: bankDraft.bankCode,
            accountNumber: bankDraft.accountNumber,
            accountName: bankDraft.accountName,
        };
        if (!validateDrawer(DriverEditSchema, payload, setBankErrors)) return;
        updateDriver.mutate(payload);
    };

    if (isPending) {
        return (
            <div className="w-full min-w-0 max-w-3xl">
                <div className="flex flex-col gap-4">
                    <div className="h-16 animate-pulse rounded bg-muted" />
                    <div className="h-16 animate-pulse rounded bg-muted" />
                    <div className="h-16 animate-pulse rounded bg-muted" />
                </div>
            </div>
        );
    }

    if (isError || !data) {
        return <DriverProfileUnavailable error={error} notFound={!isError} />;
    }

    const driver = data;
    const name = `${driver.firstName} ${driver.lastName}`.trim() || "Driver";
    const initials = getInitials(name);

return (
        <div className="w-full min-w-0 max-w-3xl">
            <DriverPhotoRow
                profilePic={driver.profile_pic}
                name={name}
                initials={initials}
            />
            <Row
                label="Full name"
                required
                description="This will be displayed on your profile."
            >
                <span className="text-sm text-foreground">{name}</span>
                <EditLink onClick={openPersonal} />
            </Row>
            <Row
                label="Contact email"
                required
                description="Where you'll receive driver updates."
            >
                <span className="text-sm text-foreground">{driver.email}</span>
                <EditLink onClick={openPersonal} />
            </Row>
            <Row
                label="Phone"
                required
                description="Your contact phone number."
            >
                <span className="text-sm text-foreground">{driver.phone ? formatPhoneDisplay(driver.phone) : "Not set"}</span>
                <EditLink onClick={openPersonal} />
            </Row>
            <Row label="Location" description="Your country, state, and city.">
                <div className="flex flex-col gap-1">
                    <span className="text-sm text-foreground">{driver.country}</span>
                    <span className="text-sm text-foreground">{driver.state}</span>
                    <span className="text-sm text-foreground">{driver.city}</span>
                </div>
                <EditLink onClick={openAddress} />
            </Row>
            <Row label="Home address" description="Your residential address.">
                <span className="text-sm text-foreground">{driver.address}</span>
                <EditLink onClick={openAddress} />
            </Row>
            <Row label="Withdrawal bank" description="Bank used for payout transfers.">
                <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-foreground">
                        {driver.bankName ?? "Not set"}
                    </span>
                    <BankStatus status={driver.bankVerificationStatus} />
                </span>
                <EditLink onClick={openBank} />
            </Row>
            <Row label="Account" description="Your payout bank account details.">
                <div className="flex flex-col gap-1">
                    <span className="text-sm text-foreground">
                        {driver.accountName ?? "Not set"}
                    </span>
                    <span className="text-sm text-foreground">
                        {driver.accountNumber ?? "Not set"}
                    </span>
                </div>
                <EditLink onClick={openBank} />
            </Row>
            <Row
                label="Identity verification"
                description="Confirmed at signup and cannot be changed."
                isLast
            >
                <KycStatus status={driver.kycStatus} kycType={driver.kycType} />
            </Row>

            <Drawer open={isPersonalOpen} onOpenChange={setIsPersonalOpen}>
                <DrawerContent>
                    <div className="mx-auto w-full max-w-lg">
                    <DrawerHeader className="sm:text-left">
                        <DrawerTitle>Update personal details</DrawerTitle>
                        <DrawerDescription>
                            Edit your name, email, and phone number.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="flex flex-col gap-4 px-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field
                                label="First name"
                                htmlFor="edit-driver-firstName"
                                error={personalErrors.firstName}
                            >
                                <Input
                                    id="edit-driver-firstName"
                                    value={personalDraft.firstName}
                                    onChange={(event) =>
                                        updatePersonalDraft("firstName", event.target.value)
                                    }
                                />
                            </Field>
                            <Field
                                label="Last name"
                                htmlFor="edit-driver-lastName"
                                error={personalErrors.lastName}
                            >
                                <Input
                                    id="edit-driver-lastName"
                                    value={personalDraft.lastName}
                                    onChange={(event) =>
                                        updatePersonalDraft("lastName", event.target.value)
                                    }
                                />
                            </Field>
                        </div>
                        <Field label="Email" htmlFor="edit-driver-email" error={personalErrors.email}>
                            <Input
                                id="edit-driver-email"
                                type="email"
                                value={personalDraft.email}
                                onChange={(event) =>
                                    updatePersonalDraft("email", event.target.value)
                                }
                            />
                        </Field>
                        <Field label="Phone" htmlFor="edit-driver-phone" error={personalErrors.phone}>
                            <Input
                                id="edit-driver-phone"
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel"
                                placeholder={PHONE_PLACEHOLDER}
                                value={personalDraft.phone}
                                onChange={(event) =>
                                    updatePersonalDraft(
                                        "phone",
                                        formatPhoneDisplay(event.target.value),
                                    )
                                }
                            />
                        </Field>
                    </div>
                    </div>
                    <DrawerFooter>
                        {updateDriver.isError && (
                            <p className="w-full text-center text-sm text-destructive">
                                {getApiErrorMessage(
                                    updateDriver.error,
                                    "Something went wrong. Please try again.",
                                )}
                            </p>
                        )}
                        <Button
                            type="button"
                            pill
                            onClick={handleSavePersonal}
                            disabled={updateDriver.isPending}
                            className="font-semibold text-sm"
                        >
                            Save changes
                        </Button>
                        </DrawerFooter>
                </DrawerContent>
            </Drawer>

            <Drawer open={isAddressOpen} onOpenChange={setIsAddressOpen}>
                <DrawerContent>
                    <div className="mx-auto w-full max-w-lg">
                    <DrawerHeader className="sm:text-left">
                        <DrawerTitle>Update address</DrawerTitle>
                        <DrawerDescription>
                            Edit your residential and currency details.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="flex flex-col gap-4 px-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field
                                label="Country"
                                htmlFor="edit-driver-country"
                                error={addressErrors.country}
                            >
                                <Select
                                    id="edit-driver-country"
                                    value={addressDraft.country}
                                    onChange={(value) =>
                                        updateAddressDraft("country", value)
                                    }
                                    items={KORA_SUPPORTED_COUNTRIES.map((country) => ({
                                        value: country,
                                        label: country,
                                    }))}
                                />
                            </Field>
                            <Field
                                label="Currency"
                                htmlFor="edit-driver-currency"
                                error={addressErrors.currency}
                            >
                                <Input
                                    id="edit-driver-currency"
                                    maxLength={3}
                                    value={addressDraft.currency}
                                    disabled
                                    className="disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                                />
                            </Field>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field
                                label="State"
                                htmlFor="edit-driver-state"
                                error={addressErrors.state}
                            >
                                <Select
                                    id="edit-driver-state"
                                    value={addressDraft.state}
                                    onChange={(value) => {
                                        updateAddressDraft("state", value);
                                        updateAddressDraft("city", "");
                                    }}
                                    placeholder="Select state"
                                    items={[
                                        { value: "", label: "Select state", disabled: true },
                                        ...NIGERIAN_STATES.map((state) => ({
                                            value: state.name,
                                            label: state.name,
                                        })),
                                    ]}
                                />
                            </Field>
                            <Field
                                label="City"
                                htmlFor="edit-driver-city"
                                error={addressErrors.city}
                            >
                                <Select
                                    id="edit-driver-city"
                                    value={addressDraft.city}
                                    disabled={!addressDraft.state}
                                    onChange={(value) =>
                                        updateAddressDraft("city", value)
                                    }
                                    placeholder={
                                        addressDraft.state ? "Select city" : "Select a state first"
                                    }
                                    items={[
                                        {
                                            value: "",
                                            label: addressDraft.state ? "Select city" : "Select a state first",
                                            disabled: true,
                                        },
                                        ...addressStateCities.map((city) => ({
                                            value: city,
                                            label: city,
                                        })),
                                    ]}
                                />
                            </Field>
                        </div>
                        <Field
                            label="Home address"
                            htmlFor="edit-driver-address"
                            error={addressErrors.address}
                        >
                            <Input
                                id="edit-driver-address"
                                value={addressDraft.address}
                                onChange={(event) =>
                                    updateAddressDraft("address", event.target.value)
                                }
                            />
                        </Field>
                    </div>
                    </div>
                    <DrawerFooter>
                        {updateDriver.isError && (
                            <p className="w-full text-center text-sm text-destructive">
                                {getApiErrorMessage(
                                    updateDriver.error,
                                    "Something went wrong. Please try again.",
                                )}
                            </p>
                        )}
                        <Button
                            type="button"
                            pill
                            onClick={handleSaveAddress}
                            disabled={updateDriver.isPending}
                            className="font-semibold text-sm"
                        >
                            Save changes
                        </Button>
                        </DrawerFooter>
                </DrawerContent>
            </Drawer>

            <Drawer open={isBankOpen} onOpenChange={setIsBankOpen}>
                <DrawerContent>
                    <div className="mx-auto w-full max-w-lg">
                    <DrawerHeader className="sm:text-left">
                        <DrawerTitle>Update bank details</DrawerTitle>
                        <DrawerDescription>
                            Changing your bank re-verifies the account.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="flex flex-col gap-4 px-4">
                        <Field label="Bank" htmlFor="edit-driver-bankName" error={bankErrors.bankName}>
                            <Select
                                id="edit-driver-bankName"
                                value={bankDraft.bankName}
                                onChange={(value) => {
                                    const bank = BANKS.find(
                                        (option) => option.name === value,
                                    );
                                    updateBankDraft("bankName", value);
                                    updateBankDraft("bankCode", bank?.code ?? "");
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
                        <Field label="Account number" htmlFor="edit-driver-accountNumber" error={bankErrors.accountNumber}>
                            <Input
                                id="edit-driver-accountNumber"
                                inputMode="numeric"
                                maxLength={10}
                                value={bankDraft.accountNumber}
                                onChange={(event) =>
                                    updateBankDraft("accountNumber", event.target.value)
                                }
                                placeholder="0123456789"
                            />
                        </Field>
                        <Field label="Account name" htmlFor="edit-driver-accountName" error={bankErrors.accountName}>
                            <Input
                                id="edit-driver-accountName"
                                value={bankDraft.accountName}
                                onChange={(event) =>
                                    updateBankDraft("accountName", event.target.value)
                                }
                                placeholder="Account holder name"
                            />
                        </Field>
                    </div>
                    </div>
                    <DrawerFooter>
                        {updateDriver.isError && (
                            <p className="w-full text-center text-sm text-destructive">
                                {getApiErrorMessage(
                                    updateDriver.error,
                                    "Something went wrong. Please try again.",
                                )}
                            </p>
                        )}
                        <Button
                            type="button"
                            pill
                            onClick={handleSaveBank}
                            disabled={updateDriver.isPending}
                            className="font-semibold text-sm"
                        >
                            Save changes
                        </Button>
                        </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    );
};

export { DriverCard };