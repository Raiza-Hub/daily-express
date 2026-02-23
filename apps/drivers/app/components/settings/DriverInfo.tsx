"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
    CaretDownIcon,
    CheckIcon,
    TrashIcon,
    UserCircleIcon
} from "@phosphor-icons/react";
import { onboardingSchema } from "@repo/types/index";
import { z } from "zod";
import { Button } from "@repo/ui/components/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@repo/ui/components/command";
import {
    CountrySelect,
    FlagComponent,
    PhoneInput,
} from "@repo/ui/components/comp-46";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@repo/ui/components/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/select";
import { useFileUpload } from "@repo/ui/hooks/use-file-upload";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import PhoneNumberInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import CountryList from "../../../country-list.json";
import { cn } from "@repo/ui/lib/utils";
import DisableAccount from "./DisableAccount";

const DriverInfoSchema = onboardingSchema.omit({
    bankName: true,
    accountNumber: true,
    accountName: true,
});

type TDriverInfoSchema = z.infer<typeof DriverInfoSchema>;


export default function DriverInfo() {
    const [openCountry, setOpenCountry] = useState(false);
    const [openState, setOpenState] = useState(false);

    const [
        { isDragging, files },
        { removeFile, openFileDialog, getInputProps, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, addFiles }
    ] = useFileUpload({
        accept: "image/*",
        multiple: false,
    });

    const {
        handleSubmit,
        control,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<TDriverInfoSchema>({
        resolver: zodResolver(DriverInfoSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            file: undefined,
            email: "",
            country: "",
            address: "",
            city: "",
            state: "",
            phoneNumber: "",
        },
    });

    const selectedCountry = watch("country");
    const selectedState = watch("state");

    const countries = CountryList.data;
    const states =
        countries.find((c) => c.name === selectedCountry)?.states || [];

    const currentFile = files[0] || null;

    const onSubmit = (data: TDriverInfoSchema) => {
        console.log("Account form submitted:", data);
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="mb-6 py-4 border-b border-gray-100">
                <h1 className="text-xl font-semibold mb-1">Driver Profile</h1>
                <p className="text-sm text-muted-foreground">
                    Update your personal details and account information.
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                <FieldGroup className="space-y-6">

                    {/* Profile Image */}
                    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
                        <FieldLabel htmlFor="file" className="pt-2.5">
                            Profile Image
                        </FieldLabel>

                        <div className="flex flex-col items-center gap-2">
                            <Controller
                                name="file"
                                control={control}
                                render={() => (
                                    <>
                                        <div className="relative inline-flex">
                                            <button
                                                id="file"
                                                type="button"
                                                className={cn(
                                                    "relative flex size-24 items-center justify-center overflow-hidden rounded-full border border-dashed transition-colors",
                                                    isDragging && "bg-accent/50",
                                                    errors.file ? "border-red-500" : "border-input"
                                                )}
                                                onClick={openFileDialog}
                                                onDragEnter={handleDragEnter}
                                                onDragLeave={handleDragLeave}
                                                onDragOver={handleDragOver}
                                                onDrop={handleDrop}
                                            >
                                                {currentFile?.preview ? (
                                                    <img src={currentFile.preview} alt="Logo preview" className="object-cover size-full" />
                                                ) : (
                                                    <UserCircleIcon className="size-6 opacity-60" />
                                                )}
                                            </button>

                                            {currentFile && (
                                                <Button
                                                    type="button"
                                                    onClick={() => {
                                                        removeFile(currentFile.id);
                                                        setValue("file", undefined, { shouldValidate: true, shouldDirty: true });
                                                    }}
                                                    size="icon"
                                                    className="absolute -top-1 -right-1 size-6 rounded-full border-2 border-background"
                                                >
                                                    <TrashIcon className="size-3.5" />
                                                </Button>
                                            )}

                                            <input {...getInputProps()} className="sr-only" />
                                        </div>

                                        {errors.file && <p className="text-xs text-red-500 mt-1">{errors.file.message}</p>}
                                    </>
                                )}
                            />
                        </div>
                    </div>

                    {/* Full Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
                        <FieldLabel htmlFor="firstName" className="pt-2.5">
                            Full Name
                        </FieldLabel>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Controller
                                name="firstName"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <Input
                                            id="firstName"
                                            {...field}
                                            placeholder="First name on ID"
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />

                            <Controller
                                name="lastName"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <Input
                                            id="lastName"
                                            {...field}
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Last name on ID"
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
                        <FieldLabel htmlFor="email" className="pt-2.5">
                            Email
                        </FieldLabel>

                        <Controller
                            name="email"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <Input
                                        id="email"
                                        {...field}
                                        type="email"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="Email"
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </div>


                    {/* Country */}
                    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
                        <FieldLabel htmlFor="country" className="pt-2.5">
                            Country
                        </FieldLabel>

                        <Controller
                            name="country"
                            control={control}
                            render={({ fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <Popover open={openCountry} onOpenChange={setOpenCountry}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                // className="w-full justify-between"
                                                className={cn(
                                                    "w-full justify-between border-input bg-background px-3 font-normal outline-offset-0 outline-none hover:bg-background focus-visible:outline-[3px] cursor-pointer",
                                                    errors.country && "border-red-500"
                                                )}
                                            >
                                                {selectedCountry || "Select your country"}
                                                <CaretDownIcon className="h-4 w-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full min-w-(--radix-popper-anchor-width) border-input p-0">
                                            <Command>
                                                <CommandInput placeholder="Search country..." />
                                                <CommandList>
                                                    <CommandEmpty>No country found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {countries.map((country) => (
                                                            <CommandItem
                                                                key={country.iso3}
                                                                value={country.name}
                                                                onSelect={(value) => {
                                                                    setValue("country", value, { shouldValidate: true });
                                                                    setValue("state", "");
                                                                    setOpenCountry(false);
                                                                }}
                                                            >
                                                                {country.name}
                                                                {selectedCountry === country.name && (
                                                                    <CheckIcon className="ml-auto h-4 w-4" />
                                                                )}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </Field>
                            )}
                        />
                    </div>

                    {/* State */}
                    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
                        <FieldLabel htmlFor="state" className="pt-2.5">
                            State / Province
                        </FieldLabel>

                        <Controller
                            name="state"
                            control={control}
                            render={({ fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <Popover open={openState} onOpenChange={setOpenState}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                aria-expanded={openState}
                                                disabled={!selectedCountry}
                                                className={cn(
                                                    "w-full justify-between border-input bg-background px-3 font-normal outline-offset-0 outline-none hover:bg-background focus-visible:outline-[3px] cursor-pointer",
                                                    errors.state && "border-red-500"
                                                )}
                                            >
                                                {selectedState || "Select your state"}
                                                <CaretDownIcon className=" h-4 w-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full min-w-(--radix-popper-anchor-width) border-input p-0">
                                            <Command>
                                                <CommandInput placeholder="Search state..." />
                                                <CommandList>
                                                    <CommandEmpty>No state found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {states.map((state) => (
                                                            <CommandItem
                                                                key={state.state_code}
                                                                value={state.name}
                                                                onSelect={(value) => {
                                                                    setValue("state", value, { shouldValidate: true });
                                                                    setOpenState(false);
                                                                }}
                                                            >
                                                                {state.name}
                                                                {selectedState === state.name && (
                                                                    <CheckIcon className="ml-auto h-4 w-4" />
                                                                )}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </Field>
                            )}
                        />
                    </div>

                    {/* City */}
                    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
                        <FieldLabel htmlFor="city" className="pt-2.5">
                            Local Government Area (LGA)
                        </FieldLabel>

                        <Controller
                            name="city"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>

                                    <Input
                                        {...field}
                                        id="city"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="LGA"
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </div>

                    {/* Address */}
                    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
                        <FieldLabel htmlFor="address" className="pt-2.5">
                            Residential Address
                        </FieldLabel>

                        <Controller
                            name="address"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>

                                    <Input
                                        {...field}
                                        id="address"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="e.g. 12 Allen Avenue, Ikeja"
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </div>

                    {/* Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-x-6 gap-y-2">
                        <FieldLabel htmlFor="phoneNumber" className="pt-2.5">
                            Phone Number
                        </FieldLabel>

                        <Controller
                            name="phoneNumber"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <PhoneNumberInput
                                        id="phoneNumber"
                                        aria-invalid={fieldState.invalid}
                                        international
                                        flagComponent={FlagComponent}
                                        countrySelectComponent={CountrySelect}
                                        inputComponent={PhoneInput}
                                        placeholder="Enter phone number"
                                        value={field.value}
                                        onChange={(val) => field.onChange(val || "")}
                                        className={cn(
                                            "flex rounded-md shadow-xs transition-colors",
                                            errors.phoneNumber && "border-destructive ring-destructive/20 focus-within:ring-[3px] focus-within:ring-destructive/20"
                                        )}
                                    />
                                    <FieldDescription>
                                        Passengers may call this number if they need help locating you or clarifying trip details.
                                    </FieldDescription>
                                </Field>
                            )}
                        />
                    </div>
                </FieldGroup>

                <div className="mt-8 flex justify-end">
                    <Button variant="secondary" type="submit" className="cursor-pointer" disabled={isSubmitting}>
                        {isSubmitting ? "Saving…" : "Save Changes"}
                    </Button>
                </div>
            </form>

            <DisableAccount />

        </div>
    );
}
