"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "@repo/ui/Drawer";
import { CalendarIcon } from "lucide-react";

const PHONE_REGEX = /^\+234[789]\d{9}$/;
const MINIMUM_ACCOUNT_AGE = 14;
const GENDERS = ["male", "female"] as const;
type Gender = (typeof GENDERS)[number];

interface FieldErrors {
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
}

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
    const [phone, setPhone] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
    const [gender, setGender] = useState<Gender | undefined>(undefined);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const validate = (): FieldErrors => {
        const nextErrors: FieldErrors = {};
        if (!phone.trim()) {
            nextErrors.phone = "Phone number is required";
        } else if (!PHONE_REGEX.test(phone.trim())) {
            nextErrors.phone =
                "Enter a valid Nigerian phone number in international format (e.g. +2348012345678)";
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

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextErrors = validate();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;
        // UI-only for now: no real mutation wired up yet.
        console.log({ phone, dateOfBirth, gender });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
            {/* Phone number */}
            <div className="flex flex-col gap-2">
                <label
                    htmlFor="phone"
                    className="text-sm font-medium text-foreground"
                >
                    Phone number
                </label>
                <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="+234 801 234 5678"
                    value={phone}
                    onChange={(event) => {
                        setPhone(event.target.value);
                        if (errors.phone) setErrors((current) => ({ ...current, phone: undefined }));
                    }}
                    className={`h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                        errors.phone ? "border-destructive" : "border-border"
                    }`}
                />
                {errors.phone && (
                    <p className="text-sm text-destructive">{errors.phone}</p>
                )}
            </div>

            {/* Date of birth */}
            <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                    Date of birth
                </span>
                <button
                    type="button"
                    onClick={() => setIsCalendarOpen(true)}
                    className={`flex h-10 w-full cursor-pointer items-center justify-between rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                        errors.dateOfBirth ? "border-destructive" : "border-border"
                    }`}
                >
                    <span className={dateOfBirth ? "text-foreground" : "text-muted-foreground"}>
                        {dateOfBirth ? format(dateOfBirth, "d MMM yyyy") : "Not set"}
                    </span>
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                </button>
                {errors.dateOfBirth && (
                    <p className="text-sm text-destructive">{errors.dateOfBirth}</p>
                )}
            </div>

            {/* Gender */}
            <fieldset className="flex flex-col">
                <legend className="text-sm font-medium text-foreground mb-3">
                    Gender
                </legend>
                <div className="flex flex-col gap-3" role="radiogroup">
                    {GENDERS.map((option) => {
                        const checked = gender === option;
                        return (
                            <label
                                key={option}
                                className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                            >
                                <input
                                    type="radio"
                                    name="gender"
                                    value={option}
                                    checked={checked}
                                    onChange={() => {
                                        setGender(option);
                                        if (errors.gender)
                                            setErrors((current) => ({ ...current, gender: undefined }));
                                    }}
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
                                {option === "male" ? "Male" : "Female"}
                            </label>
                        );
                    })}
                </div>
                {errors.gender && (
                    <p className="text-sm text-destructive mt-2">{errors.gender}</p>
                )}
            </fieldset>

            <Button type="submit" pill className="w-full">
                Continue
            </Button>

            <Drawer open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <DrawerContent>
                    <DrawerHeader className="sm:text-center">
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
                                setErrors((current) => ({ ...current, dateOfBirth: undefined }));
                                setIsCalendarOpen(false);
                            }}
                        />
                    </div>
                </DrawerContent>
            </Drawer>
        </form>
    );
}

export default OnboardingForm;