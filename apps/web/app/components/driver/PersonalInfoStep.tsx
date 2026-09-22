"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useFileUpload } from "@repo/ui/hooks/use-file-upload";
import { Trash2, User } from "lucide-react";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import type { DriverSignupData, DriverStepErrors } from "~/lib/driverSignup";

interface PersonalInfoStepProps {
    data: DriverSignupData;
    errors: DriverStepErrors;
    onChange: (patch: Partial<DriverSignupData>) => void;
}

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const PersonalInfoStep = ({ data, errors, onChange }: PersonalInfoStepProps) => {
    const [uploadState, uploadActions] = useFileUpload({
        maxSize: MAX_PHOTO_SIZE,
        accept: "image/jpeg,image/png,image/webp",
        multiple: false,
        initialFiles: data.file instanceof File ? [data.file] : [],
        onFilesChange: (files) => {
            const entry = files[0];
            if (entry && entry.file instanceof File) {
                onChange({ file: entry.file });
            } else {
                onChange({ file: undefined });
            }
        },
    });

    const photoEntry = uploadState.files[0];

    useEffect(() => {
        return () => {
            if (photoEntry?.preview && photoEntry.file instanceof File) {
                URL.revokeObjectURL(photoEntry.preview);
            }
        };
    }, [photoEntry]);

    const handleRemovePhoto = () => {
        if (photoEntry) uploadActions.removeFile(photoEntry.id);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Profile photo */}
            <Field label="Profile photo" htmlFor="profile-photo">
                <div className="flex flex-col items-center gap-3">
                    <input
                        {...uploadActions.getInputProps({
                            id: "profile-photo",
                            className: "sr-only",
                            "aria-label": "Profile photo",
                        })}
                    />
                    <div className="relative h-28 w-28">
                        <button
                            type="button"
                            onClick={uploadActions.openFileDialog}
                            aria-label="Upload profile photo"
                            className="h-28 w-28 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                            <span className="absolute inset-0 block overflow-hidden rounded-full border border-border bg-background">
                                {photoEntry?.preview ? (
                                    <Image
                                        src={photoEntry.preview}
                                        alt="Profile preview"
                                        fill
                                        unoptimized
                                        sizes="112px"
                                        className="object-cover"
                                    />
                                ) : (
                                    <User className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground" />
                                )}
                            </span>
                        </button>
                        {photoEntry && (
                            <button
                                type="button"
                                onClick={handleRemovePhoto}
                                aria-label="Remove photo"
                                className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-destructive text-white shadow hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </Field>
            {(errors.file || uploadState.errors[0]) && (
                <p className="text-center text-sm text-destructive">{errors.file || uploadState.errors[0]}</p>
            )}

            {/* First name */}
            <Field label="First name" htmlFor="firstName" error={errors.firstName}>
                <Input
                    id="firstName"
                    value={data.firstName}
                    onChange={(event) => onChange({ firstName: event.target.value })}
                    invalid={Boolean(errors.firstName)}
                    autoComplete="given-name"
                    placeholder="Enter your first name"
                />
            </Field>

            {/* Last name */}
            <Field label="Last name" htmlFor="lastName" error={errors.lastName}>
                <Input
                    id="lastName"
                    value={data.lastName}
                    onChange={(event) => onChange({ lastName: event.target.value })}
                    invalid={Boolean(errors.lastName)}
                    autoComplete="family-name"
                    placeholder="Enter your last name"
                />
            </Field>

            {/* Email */}
            <Field label="Email" htmlFor="email" error={errors.email}>
                <Input
                    id="email"
                    type="email"
                    value={data.email}
                    onChange={(event) => onChange({ email: event.target.value })}
                    invalid={Boolean(errors.email)}
                    autoComplete="email"
                    placeholder="you@example.com"
                />
            </Field>
        </div>
    );
};

export { PersonalInfoStep };