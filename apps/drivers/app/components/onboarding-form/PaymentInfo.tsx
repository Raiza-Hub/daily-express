"use client"

import BankList from "../../../bank-names.json";
import { TonboardingSchema } from "@repo/types/index";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input";
import { Controller, useFormContext } from "react-hook-form";
import { useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@repo/ui/components/command";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import Image from "next/image";

interface Bank {
    name: string;
    slug: string;
    code: string;
    ussd: string;
}



const PaymentInfo = () => {
    const [openBank, setOpenBank] = useState(false);
    const { control, setValue, watch, formState: { errors } } = useFormContext<TonboardingSchema>();

    const selectedBankName = watch("bankName");
    const selectedBank = (BankList as Bank[]).find(b => b.name === selectedBankName);

    return (
        <div>
            <FieldGroup>
                <div className="grid gap-6 mt-6">
                    <div className="grid gap-2">
                        <Controller
                            name="accountName"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="accountName">
                                        Account Name
                                    </FieldLabel>
                                    <Input
                                        {...field}
                                        id="accountName"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="Account name"
                                        autoComplete="off"
                                    />
                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Controller
                            name="accountNumber"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="accountNumber">
                                        Account Number
                                    </FieldLabel>
                                    <Input
                                        {...field}
                                        id="accountNumber"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="Account number"
                                        autoComplete="off"
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
                            name="bankName"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="bankName">
                                        Bank Name
                                    </FieldLabel>
                                    <Popover open={openBank} onOpenChange={setOpenBank}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openBank}
                                                className={cn(
                                                    "w-full justify-between border-input bg-background px-3 font-normal outline-offset-0 outline-none hover:bg-background focus-visible:outline-[3px] cursor-pointer",
                                                    errors.bankName && "border-red-500"
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {selectedBank && (
                                                        <Image
                                                            src={`/logos/${selectedBank.slug}.png`}
                                                            alt={selectedBank.name}
                                                            width={20}
                                                            height={20}
                                                            className="rounded-sm object-contain"
                                                        />
                                                    )}
                                                    {selectedBankName || "Select bank"}
                                                </div>
                                                <CaretDownIcon className="ml-2 h-4 w-4 shrink-0" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full min-w-(--radix-popper-anchor-width) border-input p-0">
                                            <Command>
                                                <CommandInput placeholder="Search bank..." />
                                                <CommandList>
                                                    <CommandEmpty>No bank found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {(BankList as Bank[]).map((bank) => (
                                                            <CommandItem
                                                                key={bank.code}
                                                                value={bank.name}
                                                                onSelect={(value) => {
                                                                    setValue("bankName", value, { shouldValidate: true })
                                                                    setOpenBank(false)
                                                                }}
                                                                className="flex items-center gap-2"
                                                            >
                                                                <Image
                                                                    src={`/logos/${bank.slug}.png`}
                                                                    alt={bank.name}
                                                                    width={20}
                                                                    height={20}
                                                                    className="rounded-sm object-contain"
                                                                />
                                                                <span>{bank.name}</span>
                                                                {selectedBankName === bank.name && (
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

                </div>
            </FieldGroup>
        </div>
    )
}

export default PaymentInfo;