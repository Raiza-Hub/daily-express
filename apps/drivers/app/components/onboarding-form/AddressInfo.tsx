"use client"

import CountryList from "../../../country-list.json"
import { cn } from "@repo/ui/lib/utils"
import { TonboardingSchema } from "@repo/types/index"
import { useState } from "react"
import { Controller, useFormContext } from "react-hook-form"
import { Button } from "@repo/ui/components/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@repo/ui/components/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@repo/ui/components/popover"
import { Input } from "@repo/ui/components/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field"
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react"
import PhoneNumberInput from "react-phone-number-input"
import "react-phone-number-input/style.css"
import { CountrySelect, FlagComponent, PhoneInput } from "@repo/ui/components/comp-46"

const AddressInfoForm = () => {
    const [openCountry, setOpenCountry] = useState(false)
    const [openState, setOpenState] = useState(false)

    const {
        register,
        setValue,
        watch,
        control,
        formState: { errors },
    } = useFormContext<TonboardingSchema>()

    // Watch values to reactively show states
    const selectedCountry = watch("country")
    const selectedState = watch("state")

    const countries = CountryList.data
    const states =
        countries.find((c) => c.name === selectedCountry)?.states || []

    return (
        <div>
            <FieldGroup>
                <div className="grid gap-6">
                    {/* COUNTRY SELECT */}
                    <div className="grid gap-2 py-2">
                        <Controller
                            name="country"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="country">
                                        Select Country
                                    </FieldLabel>
                                    <Popover open={openCountry} onOpenChange={setOpenCountry}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openCountry}
                                                className={cn(
                                                    "w-full justify-between border-input bg-background px-3 font-normal outline-offset-0 outline-none hover:bg-background focus-visible:outline-[3px] cursor-pointer",
                                                    errors.country && "border-red-500"
                                                )}
                                            >
                                                {selectedCountry || "Select country"}
                                                <CaretDownIcon className="ml-2 h-4 w-4" />
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
                                                                    // Update form value
                                                                    setValue("country", value, { shouldValidate: true })
                                                                    // Reset state when new country selected
                                                                    setValue("state", "", { shouldValidate: true })
                                                                    setOpenCountry(false)
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
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </div>

                    {/* STATE SELECT */}
                    <div className="grid gap-2 py-2">
                        <Controller
                            name="state"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="state">
                                        Select State
                                    </FieldLabel>
                                    <Popover open={openState} onOpenChange={setOpenState}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openState}
                                                disabled={!selectedCountry}
                                                className={cn(
                                                    "w-full justify-between border-input bg-background px-3 font-normal outline-offset-0 outline-none hover:bg-background focus-visible:outline-[3px] cursor-pointer",
                                                    errors.state && "border-red-500"
                                                )}
                                            >
                                                {selectedState || "Select state"}
                                                <CaretDownIcon className="ml-2 h-4 w-4" />
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
                                                                    setValue("state", value, { shouldValidate: true })
                                                                    setOpenState(false)
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
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </div>


                    <div className="grid gap-2 py-2">
                        <Controller
                            name="city"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="city">
                                        City
                                    </FieldLabel>
                                    <Input
                                        {...field}
                                        id="city"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="City"
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </div>

                    <div className="grid gap-2 py-2">
                        <Controller
                            name="address"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="address">
                                        Address
                                    </FieldLabel>
                                    <Input
                                        {...field}
                                        id="address"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="Address"
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </div>

                    <div className="grid gap-2 py-2">
                        <Controller
                            name="phoneNumber"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="phoneNumber">
                                        Phone Number
                                    </FieldLabel>
                                    <PhoneNumberInput
                                        international
                                        flagComponent={FlagComponent}
                                        countrySelectComponent={CountrySelect}
                                        inputComponent={PhoneInput}
                                        placeholder="Enter phone number"
                                        value={field.value}
                                        onChange={(val) => field.onChange(val || "")}
                                        className={cn(
                                            "flex rounded-md shadow-xs",
                                            errors.phoneNumber && "border-red-500 focus-visible:ring-red-500"
                                        )}
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </div>
                     
                </div>
            </FieldGroup>
        </div>
    )
}

export default AddressInfoForm
