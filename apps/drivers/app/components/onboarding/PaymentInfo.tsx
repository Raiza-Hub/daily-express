"use client";

import BankList from "../../../bank-names.json";
import { TonboardingSchema } from "@repo/types/index";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Controller, useFormContext } from "react-hook-form";
import { useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
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
import { Bank } from "~/lib/type";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";


const PaymentInfo = () => {
  const [openBank, setOpenBank] = useState(false);
  const {
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<TonboardingSchema>();
  const bankListboxId = "driver-bank-options";

  const selectedBankName = watch("bankName");
  const selectedBank = (BankList as Bank[]).find(
    (b) => b.name === selectedBankName,
  );
  const selectedKycType = watch("kycType");

  return (
    <div>
      <FieldGroup>
        <div className="grid gap-6">
          <div className="grid gap-2">
            <Controller
              name="accountName"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="accountName">Account Name</FieldLabel>
                  <Input
                    {...field}
                    id="accountName"
                    aria-invalid={fieldState.invalid}
                    placeholder="Account name"
                  />
                  <FieldDescription>
                    Enter your legal Account Name
                  </FieldDescription>
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
              name="bankName"
              control={control}
              render={({ fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bankName">Bank Name</FieldLabel>
                  <Popover open={openBank} onOpenChange={setOpenBank}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={openBank}
                        aria-controls={bankListboxId}
                        className={cn(
                          "w-full justify-between border-input bg-background px-3 font-normal outline-offset-0 outline-none hover:bg-background focus-visible:outline-[3px] cursor-pointer",
                          errors.bankName && "border-red-500",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {selectedBank && (
                            <span className="relative inline-flex size-5 shrink-0">
                              <Image
                                src={`/logos/${selectedBank.slug}.png`}
                                alt={selectedBank.name}
                                fill
                                sizes="20px"
                                unoptimized
                                className="rounded-sm object-contain"
                              />
                            </span>
                          )}
                          {selectedBankName || "Select your bank"}
                        </div>
                        <CaretDownIcon className="ml-2 size-4 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full min-w-(--radix-popper-anchor-width) border-input p-0">
                      <Command>
                        <CommandInput placeholder="Search bank..." />
                        <CommandList id={bankListboxId}>
                          <CommandEmpty>No bank found.</CommandEmpty>
                          <CommandGroup>
                            {(BankList as Bank[]).map((bank) => (
                              <CommandItem
                                key={bank.code}
                                value={bank.name}
                                onSelect={(value) => {
                                  const selected = (BankList as Bank[]).find(
                                    (entry) => entry.name === value,
                                  );
                                  setValue("bankName", value, {
                                    shouldValidate: true,
                                  });
                                  setValue("bankCode", selected?.code || "", {
                                    shouldValidate: true,
                                  });
                                  setOpenBank(false);
                                }}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <span className="relative inline-flex size-5 shrink-0">
                                  <Image
                                    src={`/logos/${bank.slug}.png`}
                                    alt={bank.name}
                                    fill
                                    sizes="20px"
                                    unoptimized
                                    className="rounded-sm object-contain"
                                  />
                                </span>
                                <span>{bank.name}</span>
                                {selectedBankName === bank.name && (
                                  <CheckIcon className="ml-auto size-4" />
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

          <div className="grid gap-2">
            <Controller
              name="kycType"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="kycType">Verification Method</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger id="kycType" className="w-full cursor-pointer">
                      <SelectValue placeholder="Select verification method" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="bvn">BVN (Bank Verification Number)</SelectItem>
                      <SelectItem value="nin">NIN (National Identification Number)</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <div className="grid gap-2">
            <Controller
              name="kycId"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="kycId">
                    {selectedKycType ? `${selectedKycType.toUpperCase()} Number` : "KYC ID"}
                  </FieldLabel>
                  <Input
                    {...field}
                    id="kycId"
                    aria-invalid={fieldState.invalid}
                    placeholder={selectedKycType ? `Enter your ${selectedKycType.toUpperCase()}` : "Enter KYC ID"}
                    autoComplete="off"
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
  );
};

export default PaymentInfo;
