"use client";

import BankList from "../../../bank-names.json";
import { Button } from "@repo/ui/components/button";
import { ResponsiveModal } from "@repo/ui/ResponsiveModal";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@repo/ui/components/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@repo/ui/components/command";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { cn } from "@repo/ui/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingSchema } from "@repo/types/index";
import { z } from "zod";

interface Bank {
    name: string;
    slug: string;
    code: string;
    ussd: string;
}

const ChangeBankDetailsSchema = onboardingSchema.pick({
    accountName: true,
    accountNumber: true,
    bankName: true,
});

type TBankDetailsFormValues = z.infer<typeof ChangeBankDetailsSchema>;

export default function ChangeBankDetailsDialog() {
    const [open, setOpen] = useState(false);
    const [openBank, setOpenBank] = useState(false);

    const {
        control,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { isSubmitting, errors },
    } = useForm<TBankDetailsFormValues>({
        resolver: zodResolver(ChangeBankDetailsSchema),
        defaultValues: {
            accountName: "ADEBOLA OLUWASEMILORE WISDOM",
            accountNumber: "0524404864",
            bankName: "Guaranty Trust Bank",
        },
    });

    const selectedBankName = watch("bankName");
    const selectedBank = (BankList as Bank[]).find(
        (b) => b.name === selectedBankName
    );

    const onSubmit = async (data: TBankDetailsFormValues) => {
        console.log("Bank details submitted:", data);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setOpen(false);
    };

    const closeModal = () => {
        setOpen(false);
        setOpenBank(false);
        reset();
    };

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={(val) => {
                if (!val) { closeModal(); }
                else setOpen(true);
            }}
            trigger={
                <Button variant="secondary" className="cursor-pointer">Change</Button>
            }
            title="Change Bank Details"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4 px-4 sm:p-0">
                <div className="grid gap-6">
                    {/* Account Name */}
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
                                    <FieldDescription>
                                        Must match your bank account name.
                                    </FieldDescription>
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                    </div>

                    {/* Account Number */}
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
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                    </div>

                    {/* Bank Selector */}
                    <div className="grid gap-2">
                        <Controller
                            name="bankName"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="bankName">
                                        Bank Name
                                    </FieldLabel>
                                    <Popover
                                        open={openBank}
                                        onOpenChange={setOpenBank}
                                    >
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openBank}
                                                className={cn(
                                                    "w-full justify-between border-input bg-background px-3 font-normal outline-offset-0 outline-none hover:bg-background focus-visible:outline-[3px] cursor-pointer",
                                                    errors.bankName &&
                                                    "border-red-500"
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {selectedBank && (
                                                        <Image
                                                            src={`/logos/${selectedBank.slug}.png`}
                                                            alt={
                                                                selectedBank.name
                                                            }
                                                            width={20}
                                                            height={20}
                                                            className="rounded-sm object-contain"
                                                        />
                                                    )}
                                                    {selectedBankName ||
                                                        "Select your bank"}
                                                </div>
                                                <CaretDownIcon className="ml-2 h-4 w-4 shrink-0" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full min-w-(--radix-popper-anchor-width) border-input p-0">
                                            <Command>
                                                <CommandInput placeholder="Search bank..." />
                                                <CommandList
                                                    onWheel={(e) => {
                                                        e.currentTarget.scrollTop += e.deltaY;
                                                    }}
                                                >
                                                    <CommandEmpty>
                                                        No bank found.
                                                    </CommandEmpty>
                                                    <CommandGroup>
                                                        {(
                                                            BankList as Bank[]
                                                        ).map((bank) => (
                                                            <CommandItem
                                                                key={bank.code}
                                                                value={
                                                                    bank.name
                                                                }
                                                                onSelect={(
                                                                    value
                                                                ) => {
                                                                    setValue(
                                                                        "bankName",
                                                                        value,
                                                                        {
                                                                            shouldValidate:
                                                                                true,
                                                                        }
                                                                    );
                                                                    setOpenBank(
                                                                        false
                                                                    );
                                                                }}
                                                                className="flex items-center gap-2 cursor-pointer"
                                                            >
                                                                <Image
                                                                    src={`/logos/${bank.slug}.png`}
                                                                    alt={
                                                                        bank.name
                                                                    }
                                                                    width={20}
                                                                    height={20}
                                                                    className="rounded-sm object-contain"
                                                                />
                                                                <span>
                                                                    {bank.name}
                                                                </span>
                                                                {selectedBankName ===
                                                                    bank.name && (
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
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                    </div>
                </div>
                <div className="px-4 pb-4 pt-2 flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={closeModal}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        onClick={handleSubmit(onSubmit)}
                        variant="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </form>
        </ResponsiveModal>
    );
}
