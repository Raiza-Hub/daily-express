"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import {
  applyApiFieldErrors,
  getApiErrorMessage,
  useGetDriver,
  useUpdateDriver,
} from "@repo/api";
import { onboardingSchema } from "@repo/types/index";
import { ResponsiveModal } from "@repo/ui/ResponsiveModal";
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
import { cn } from "@repo/ui/lib/utils";
import Image from "next/image";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import {
  Controller,
  useForm,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from "react-hook-form";
import { z } from "zod/v4";
import { posthogEvents } from "~/lib/posthog-events";
import { Bank } from "~/lib/type";
import BankList from "../../../bank-names.json";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

const ChangeBankDetailsSchema = onboardingSchema
  .pick({
    accountName: true,
    accountNumber: true,
    bankName: true,
    bankCode: true,
  })
  .extend({
    kycType: z.string().optional(),
    kycId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kycType || data.kycId) {
      const label = data.kycType?.toUpperCase() || "BVN/NIN";
      if (!data.kycType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "KYC type is required when submitting verification details.",
          path: ["kycType"],
        });
      }
      if (!data.kycId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} is required.`,
          path: ["kycId"],
        });
      } else if (data.kycId.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be at least 10 digits.`,
          path: ["kycId"],
        });
      } else if (data.kycId.length > 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must not exceed 20 digits.`,
          path: ["kycId"],
        });
      }
    }
  });

type TBankDetailsFormValues = z.infer<typeof ChangeBankDetailsSchema>;

function BankNameField({
  control,
  errors,
  setValue,
  openBank,
  setOpenBank,
  isSubmitting,
  selectedBankName,
  selectedBank,
}: {
  control: Control<TBankDetailsFormValues>;
  errors: FieldErrors<TBankDetailsFormValues>;
  setValue: UseFormSetValue<TBankDetailsFormValues>;
  openBank: boolean;
  setOpenBank: (open: boolean) => void;
  isSubmitting: boolean;
  selectedBankName: string;
  selectedBank: Bank | undefined;
}) {
  return (
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
                  disabled={isSubmitting}
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
                              shouldDirty: true,
                            });
                            setValue("bankCode", selected?.code || "", {
                              shouldValidate: true,
                              shouldDirty: true,
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
  );
}

function KycFields({
  control,
  kycStatus,
  selectedKycType,
}: {
  control: Control<TBankDetailsFormValues>;
  kycStatus: string | undefined;
  selectedKycType: string | undefined;
}) {
  if (kycStatus === "active" || kycStatus === "pending") {
    return null;
  }

  return (
    <>
      <div className="grid gap-2">
        <Controller
          name="kycType"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="kycType">KYC Type</FieldLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
                <SelectTrigger id="kycType" className="w-full cursor-pointer">
                  <SelectValue placeholder="Select KYC Type" />
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
    </>
  );
}

export default function ChangeBankDetailsDialog() {
  const [open, setOpen] = useState(false);
  const [openBank, setOpenBank] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const posthog = usePostHog();

  const { data: driver, refetch } = useGetDriver();

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    watch,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<TBankDetailsFormValues>({
    resolver: zodResolver(ChangeBankDetailsSchema),
    defaultValues: {
      accountName: driver?.accountName || "",
      accountNumber: driver?.accountNumber || "",
      bankName: driver?.bankName || "",
      bankCode: driver?.bankCode || "",
      // Only pre-fill kycType when KYC fields are visible (i.e. not active/pending).
      // If we pre-fill it while the fields are hidden, superRefine will require kycId
      // and block form submission.
      kycType:
        driver?.kycStatus === "active" || driver?.kycStatus === "pending"
          ? ""
          : driver?.kycType || "",
      kycId: "",
    },
  });
  const { mutate: updateDriver, isPending } = useUpdateDriver({
    onSuccess: () => {
      posthog.capture(posthogEvents.driver_bank_details_update_succeeded);
      refetch();
      setOpen(false);
    },
    onError: (error: Error) => {
      applyApiFieldErrors<keyof TBankDetailsFormValues>(error, setError);
      posthog.captureException(error, {
        action: "driver_bank_details_update_failed",
      });
      setBankError(getApiErrorMessage(error, "Failed to update bank details"));
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({
      accountName: driver?.accountName || "",
      accountNumber: driver?.accountNumber || "",
      bankName: driver?.bankName || "",
      bankCode: driver?.bankCode || "",
      kycType:
        driver?.kycStatus === "active" || driver?.kycStatus === "pending"
          ? ""
          : driver?.kycType || "",
      kycId: "",
    });
  }, [driver, open, reset]);

  const selectedBankName = watch("bankName");
  const selectedBank = (BankList as Bank[]).find(
    (b) => b.name === selectedBankName,
  );
  const selectedKycType = watch("kycType");

  const onSubmit = async (data: TBankDetailsFormValues) => {
    const selectedBank = (BankList as Bank[]).find(
      (bank) => bank.name === data.bankName,
    );

    const payload: {
      bankName: string;
      bankCode: string;
      accountNumber: string;
      accountName: string;
      kycType?: string;
      kycId?: string;
      kycConsent?: boolean;
    } = {
      bankName: data.bankName,
      bankCode: selectedBank?.code || data.bankCode,
      accountNumber: data.accountNumber,
      accountName: data.accountName,
    };

    if (data.kycType && data.kycId) {
      payload.kycType = data.kycType;
      payload.kycId = data.kycId;
      payload.kycConsent = true;
    }

    updateDriver(payload);
  };

  const closeModal = () => {
    setOpen(false);
    setOpenBank(false);
    reset({
      accountName: driver?.accountName || "",
      accountNumber: driver?.accountNumber || "",
      bankName: driver?.bankName || "",
      bankCode: driver?.bankCode || "",
      kycType:
        driver?.kycStatus === "active" || driver?.kycStatus === "pending"
          ? ""
          : driver?.kycType || "",
      kycId: "",
    });
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          closeModal();
        } else setOpen(true);
      }}
      trigger={
        <Button variant="secondary" className="cursor-pointer">
          Change
        </Button>
      }
      title="Change Bank Details"
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 py-4 px-4 sm:p-0"
      >
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
                    autoComplete="off"
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
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <BankNameField
            control={control}
            errors={errors}
            setValue={setValue}
            openBank={openBank}
            setOpenBank={setOpenBank}
            isSubmitting={isSubmitting}
            selectedBankName={selectedBankName}
            selectedBank={selectedBank}
          />

          <KycFields
            control={control}
            kycStatus={driver?.kycStatus}
            selectedKycType={selectedKycType}
          />
        </div>
        {bankError && (
          <p className="px-1 pb-2 inline-flex justify-center text-sm text-red-500">
            {bankError}
          </p>
        )}
        <div className="px-4 pb-4 pt-2 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="cursor-pointer"
            onClick={closeModal}
          >
            Cancel
          </Button>
          <Button type="submit" variant="submit" disabled={isPending}>
            Save Changes
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
