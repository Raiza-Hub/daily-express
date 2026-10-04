"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Form } from "@base-ui/react/form";
import { useCompleteOnboarding } from "@repo/api";
import type { OnboardingInput } from "@shared/types";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { RadioGroup } from "~/components/ui/radio-group";
import { fieldControlStyles } from "~/components/ui/field-styles";
import { cn } from "@repo/ui/lib/utils";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "@repo/ui/Drawer";
import { CalendarIcon, Loader2 } from "lucide-react";
import { formatPhoneDisplay, isValidNigerianPhone, toE164 } from "~/lib/phone";
import { makeFieldErrorMapper } from "~/lib/formErrors";

const MINIMUM_ACCOUNT_AGE = 14;
const GENDERS = ["male", "female"] as const;
type Gender = (typeof GENDERS)[number];

type FieldErrors = {
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
};

function isUnder14(dateOfBirth: Date): boolean {
    const today = new Date();
    const threshold = new Date(
        today.getFullYear() - MINIMUM_ACCOUNT_AGE,
        today.getMonth(),
        today.getDate(),
    );
    return dateOfBirth > threshold;
}

function OnboardingForm() {
    const router = useRouter();
    const completeOnboarding = useCompleteOnboarding({
        onSuccess: () => router.refresh(),
    });
    const [phone, setPhone] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
    const [gender, setGender] = useState<Gender | undefined>(undefined);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [formError, setFormError] = useState<string | undefined>(undefined);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const mapFieldError = makeFieldErrorMapper<keyof FieldErrors>(
        (name, message) =>
            setErrors((current) => ({ ...current, [name]: message })),
        setFormError,
    );

    const validate = (): FieldErrors => {
        const nextErrors: FieldErrors = {};
        if (!phone.trim()) {
            nextErrors.phone = "Phone number is required";
        } else if (!isValidNigerianPhone(phone)) {
            nextErrors.phone =
                "Enter a valid Nigerian phone number in international format (e.g. +234 801 000 0000)";
        }
        if (!dateOfBirth) {
            nextErrors.dateOfBirth = "Date of birth is required";
        } else if (isUnder14(dateOfBirth)) {
            nextErrors.dateOfBirth = `You must be at least ${MINIMUM_ACCOUNT_AGE} years old`;
        }
        if (!gender) {
            nextErrors.gender = "Please select your gender";
        }
        return nextErrors;
    };

    const handleSubmit = () => {
        if (completeOnboarding.isPending) return;
        const nextErrors = validate();
        setErrors(nextErrors);
        setFormError(undefined);
        if (Object.keys(nextErrors).length > 0) return;

        const input: OnboardingInput = {
            phoneNumber: toE164(phone),
            dateOfBirth: dateOfBirth as Date,
            gender: gender as Gender,
        };

        completeOnboarding.mutate(input, {
            onError: (error: Error) => {
                const apiError = error as { code?: string; message?: string };
                if (apiError.code === "PHONE_TAKEN" && apiError.message) {
                    setErrors((current) => ({
                        ...current,
                        phone: apiError.message as string,
                    }));
                    return;
                }
                mapFieldError(error, "Something went wrong. Please try again.", {
                    phoneNumber: "phone",
                });
            },
        });
    };

    return (
        <Form
            errors={errors}
            onFormSubmit={handleSubmit}
            className="flex flex-col gap-6"
        >
            <Field label="Phone number" name="phone">
                <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="+234 801 234 5678"
                    value={phone}
                    onChange={(event) => {
                        setPhone(formatPhoneDisplay(event.target.value));
                        if (errors.phone)
                            setErrors((current) => ({
                                ...current,
                                phone: undefined,
                            }));
                    }}
                />
            </Field>

            <Field label="Date of birth" name="dateOfBirth">
                <Field.Control
                    render={
                        <button
                            type="button"
                            onClick={() => setIsCalendarOpen(true)}
                            className={cn(
                                fieldControlStyles,
                                "flex cursor-pointer items-center justify-between pr-9 text-left",
                            )}
                        >
                            <span
                                className={
                                    dateOfBirth
                                        ? "text-foreground"
                                        : "text-muted-foreground"
                                }
                            >
                                {dateOfBirth
                                    ? format(dateOfBirth, "d MMM yyyy")
                                    : "Not set"}
                            </span>
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        </button>
                    }
                />
            </Field>

            <RadioGroup
                name="gender"
                legend="Gender"
                options={GENDERS.map((option) => ({
                    value: option,
                    label: option === "male" ? "Male" : "Female",
                }))}
                value={gender ?? ""}
                onValueChange={(value) => {
                    setGender(value === "" ? undefined : value);
                    if (errors.gender)
                        setErrors((current) => ({
                            ...current,
                            gender: undefined,
                        }));
                }}
            />

            {formError && (
                <p role="alert" className="text-center text-sm text-destructive">
                    {formError}
                </p>
            )}
            <Button
                type="submit"
                pill
                className="w-full font-semibold text-sm"
                disabled={completeOnboarding.isPending}
            >
                {completeOnboarding.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                )}
                Continue
            </Button>

            <Drawer open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <DrawerContent>
                    <DrawerHeader className="text-center sm:text-center">
                        <DrawerTitle>Select date of birth</DrawerTitle>
                        <DrawerDescription>
                            Pick your year, month, and day of birth.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="flex justify-center px-4 pb-4">
                        <Calendar
                            selected={dateOfBirth}
                            onSelect={(date) => {
                                setDateOfBirth(date);
                                setErrors((current) => ({
                                    ...current,
                                    dateOfBirth: undefined,
                                }));
                                setIsCalendarOpen(false);
                            }}
                        />
                    </div>
                </DrawerContent>
            </Drawer>
        </Form>
    );
}

export default OnboardingForm;