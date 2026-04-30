
import {
  CaretDownIcon,
  CheckIcon,
  TrashIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
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
  FieldLabel
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import type {
  FileUploadActions,
  FileUploadState,
} from "@repo/ui/hooks/use-file-upload";
import { cn } from "@repo/ui/lib/utils";
import type { Driver } from "@shared/types";
import Image from "next/image";
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormSetValue
} from "react-hook-form";
import PhoneNumberInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { z } from "zod";
import CountryList from "../../country-list.json";
import { onboardingSchema } from "@repo/types/index";



export const DriverInfoSchema = onboardingSchema
  .extend({
    file: z.union([z.instanceof(File), z.string()]).optional().nullable(),
  })
  .omit({
    bankName: true,
    bankCode: true,
    accountNumber: true,
    accountName: true,
  });



type TDriverInfoSchema = z.infer<typeof DriverInfoSchema>;
type UploadedFile = FileUploadState["files"][number] | null;
type CountryState = (typeof CountryList.data)[number]["states"][number];




export const SettingsRow = ({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="grid grid-cols-1 items-start gap-x-6 gap-y-2 sm:grid-cols-[200px_1fr]">
      <FieldLabel htmlFor={htmlFor} className="pt-2.5">
        {label}
      </FieldLabel>
      {children}
    </div>
  );
}

export function PreviewImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes="96px"
      className="object-cover"
    />
  );
}

export function ProfileImageField({
  control,
  currentFile,
  driver,
  isDragging,
  errors,
  uploadActions,
  setValue,
}: {
  control: Control<TDriverInfoSchema>;
  currentFile: UploadedFile;
  driver?: Driver;
  isDragging: boolean;
  errors: FieldErrors<TDriverInfoSchema>;
  uploadActions: Pick<
    FileUploadActions,
    | "removeFile"
    | "openFileDialog"
    | "getInputProps"
    | "handleDragEnter"
    | "handleDragLeave"
    | "handleDragOver"
    | "handleDrop"
  >;
  setValue: UseFormSetValue<TDriverInfoSchema>;
}) {
  const {
    removeFile,
    openFileDialog,
    getInputProps,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = uploadActions;

  return (
    <SettingsRow label="Profile Image" htmlFor="file">
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
                    errors.file ? "border-red-500" : "border-input",
                  )}
                  onClick={openFileDialog}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {currentFile?.preview ? (
                    <PreviewImage
                      src={currentFile.preview}
                      alt="Profile preview"
                    />
                  ) : driver?.profile_pic ? (
                    <PreviewImage
                      src={driver.profile_pic}
                      alt="Profile picture"
                    />
                  ) : (
                    <UserCircleIcon className="size-6 opacity-60" />
                  )}
                </button>

                {currentFile ? (
                  <Button
                    type="button"
                    onClick={() => {
                      removeFile(currentFile.id);
                      setValue("file", undefined, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                    size="icon"
                    className="absolute -top-1 -right-1 size-6 rounded-full border-2 border-background bg-red-100 text-red-600 hover:bg-red-200"
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                ) : null}

                <input {...getInputProps()} className="sr-only" />
              </div>

              {errors.file ? (
                <p className="mt-1 text-xs text-red-500">{errors.file.message}</p>
              ) : null}
            </>
          )}
        />
      </div>
    </SettingsRow>
  );
}

export function FullNameFields({ control }: { control: Control<TDriverInfoSchema> }) {
  return (
    <SettingsRow label="Full Name" htmlFor="firstName">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
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
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
      </div>
    </SettingsRow>
  );
}

export function TextFieldRow({
  control,
  name,
  label,
  placeholder,
  type,
}: {
  control: Control<TDriverInfoSchema>;
  name: "email" | "city" | "address";
  label: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <SettingsRow label={label} htmlFor={name}>
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Input
              id={name}
              {...field}
              type={type}
              aria-invalid={fieldState.invalid}
              placeholder={placeholder}
            />
            {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
          </Field>
        )}
      />
    </SettingsRow>
  );
}

export function CountryField({
  control,
  open,
  onOpenChange,
  errors,
  selectedCountry,
  countries,
  setValue,
}: {
  control: Control<TDriverInfoSchema>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errors: FieldErrors<TDriverInfoSchema>;
  selectedCountry: string;
  countries: typeof CountryList.data;
  setValue: UseFormSetValue<TDriverInfoSchema>;
}) {
  return (
    <SettingsRow label="Country" htmlFor="country">
      <Controller
        name="country"
        control={control}
        render={({ fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Popover open={open} onOpenChange={onOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  id="country"
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-between border-input bg-background px-3 font-normal outline-offset-0 outline-none hover:bg-background focus-visible:outline-[3px] cursor-pointer",
                    errors.country && "border-red-500",
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
                            setValue("country", value, {
                              shouldValidate: true,
                            });
                            setValue("state", "");
                            onOpenChange(false);
                          }}
                        >
                          {country.name}
                          {selectedCountry === country.name ? (
                            <CheckIcon className="ml-auto h-4 w-4" />
                          ) : null}
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
    </SettingsRow>
  );
}

export function StateField({
  control,
  open,
  onOpenChange,
  errors,
  selectedCountry,
  selectedState,
  states,
  setValue,
}: {
  control: Control<TDriverInfoSchema>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errors: FieldErrors<TDriverInfoSchema>;
  selectedCountry: string;
  selectedState: string;
  states: CountryState[];
  setValue: UseFormSetValue<TDriverInfoSchema>;
}) {
  return (
    <SettingsRow label="State / Province" htmlFor="state">
      <Controller
        name="state"
        control={control}
        render={({ fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <Popover open={open} onOpenChange={onOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  id="state"
                  type="button"
                  variant="outline"
                  aria-expanded={open}
                  disabled={!selectedCountry}
                  className={cn(
                    "w-full justify-between border-input bg-background px-3 font-normal outline-offset-0 outline-none hover:bg-background focus-visible:outline-[3px] cursor-pointer",
                    errors.state && "border-red-500",
                  )}
                >
                  {selectedState || "Select your state"}
                  <CaretDownIcon className="h-4 w-4" />
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
                            setValue("state", value, {
                              shouldValidate: true,
                            });
                            onOpenChange(false);
                          }}
                        >
                          {state.name}
                          {selectedState === state.name ? (
                            <CheckIcon className="ml-auto h-4 w-4" />
                          ) : null}
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
    </SettingsRow>
  );
}

export function PhoneField({
  control,
  errors,
}: {
  control: Control<TDriverInfoSchema>;
  errors: FieldErrors<TDriverInfoSchema>;
}) {
  return (
    <SettingsRow label="Phone Number" htmlFor="phoneNumber">
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
              onChange={(value) => field.onChange(value || "")}
              className={cn(
                "flex rounded-md shadow-xs transition-colors",
                errors.phoneNumber &&
                "border-destructive ring-destructive/20 focus-within:ring-[3px] focus-within:ring-destructive/20",
              )}
            />
            <FieldDescription>
              Passengers may call this number if they need help locating you or
              clarifying trip details.
            </FieldDescription>
          </Field>
        )}
      />
    </SettingsRow>
  );
}

