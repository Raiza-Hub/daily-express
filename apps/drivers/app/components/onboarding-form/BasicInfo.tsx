"use client";

import { useFileUpload } from "@repo/ui/hooks/use-file-upload";
import { cn } from "@repo/ui/lib/utils";
import { TonboardingSchema } from "@repo/types/index";
import { useEffect, useMemo } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Button } from "@repo/ui/components/button";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@repo/ui/components/select";
import { Input } from "@repo/ui/components/input";
import { TrashIcon, UserCircleIcon } from "@phosphor-icons/react";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";

const GENDER = [
    { label: "Male", value: "male" },
    { label: "Female", value: "female" },
] as const

const BasicInfoForm = () => {
    const { control, setValue, formState: { errors } } = useFormContext<TonboardingSchema>();

    const formFile = useWatch({ control, name: "file" });

    const [
        { isDragging, files },
        { removeFile, openFileDialog, getInputProps, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, addFiles }
    ] = useFileUpload({
        accept: "image/*",
        multiple: false,
    });

    const currentFile = files[0] || null;

    useEffect(() => {
        // Only set if currentFile.file is actually a File
        if (currentFile?.file instanceof File && formFile !== currentFile.file) {
            setValue("file", currentFile.file, { shouldValidate: true, shouldDirty: true });
        }

        // If RHF has a File but hook is empty
        if (!currentFile && formFile instanceof File) {
            addFiles([formFile]); // wrap in your hook
        }
    }, [currentFile, formFile, setValue, addFiles]);

    return (
        <div>
            <FieldGroup>
                <div className="flex flex-col items-center gap-2">
                    <Controller
                        name="file"
                        control={control}
                        render={() => (
                            <>
                                <div className="relative inline-flex">
                                    <button
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

                <div className="grid gap-6 mt-6">
                    <div className="grid gap-2">
                        <Controller
                            name="firstName"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="firstName">
                                        First Name
                                    </FieldLabel>
                                    <Input
                                        {...field}
                                        id="firstName"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="First name"
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
                            name="lastName"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="lastName">
                                        Last Name
                                    </FieldLabel>
                                    <Input
                                        {...field}
                                        id="lastName"
                                        aria-invalid={fieldState.invalid}
                                        placeholder="Last name"
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
                            name="email"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="email">
                                        Email
                                    </FieldLabel>
                                    <Input
                                        {...field}
                                        id="email"
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

                    <div className="grid gap-2">
                        <Controller
                            name="gender"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field
                                    // orientation="responsive"
                                    data-invalid={fieldState.invalid}
                                >
                                    <FieldLabel htmlFor="gender">
                                        Gender
                                    </FieldLabel>
                                    <Select
                                        name={field.name}
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <SelectTrigger
                                            id="gender"
                                            aria-invalid={fieldState.invalid}
                                            className="min-w-[120px]"
                                        >
                                            <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent position="item-aligned">
                                            {/* <SelectItem value="auto">Auto</SelectItem>
                                            <SelectSeparator /> */}
                                            {GENDER.map((g) => (
                                                <SelectItem key={g.value} value={g.value}>
                                                    {g.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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

export default BasicInfoForm;
