"use client";

import { useState } from "react";
import { getApiErrorMessage, useGetMe, useUpdateProfile } from "@repo/api";
import { ProfileEditSchema, zodFieldErrors } from "@repo/types";
import { BadgeCheck } from "lucide-react";
import Image from "next/image";
import { Button } from "~/components/ui/button";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@repo/ui/Drawer";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import { Row, EditLink, getInitials } from "./settings-shared";
import { formatPhoneDisplay, PHONE_PLACEHOLDER, toE164 } from "~/lib/phone";
import { createDraftUpdater } from "~/lib/draftFields";

function VerifiedBadge() {
    return <BadgeCheck className="h-4 w-4 shrink-0 fill-blue-500 text-white" />;
}

const ProfileCard = () => {
    const { data: apiUser, isPending } = useGetMe();

    const name =
        `${apiUser?.firstName ?? ""} ${apiUser?.lastName ?? ""}`.trim() || "Not set";
    const email = apiUser?.email ?? "";
    const emailVerified = apiUser?.emailVerified ?? false;
    const phone = apiUser?.phone ?? null;
    const gender = apiUser?.gender ?? null;
    const dateOfBirth = apiUser?.dateOfBirth ?? null;
    const profilePictureUrl = apiUser?.profilePictureUrl ?? null;

    const photoSrc = profilePictureUrl ?? null;
    const initials = getInitials(name);

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [draft, setDraft] = useState({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        gender: "",
        dateOfBirth: "",
    });

    const displayDate = dateOfBirth
        ? new Date(dateOfBirth).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
          })
        : "Not set";

    const updateProfile = useUpdateProfile({
        onSuccess: () => {
            setIsEditOpen(false);
            setErrors({});
        },
        onError: () => {
            setErrors({});
        },
    });

    const updateDraft = createDraftUpdater(setDraft, setErrors);

    const openEdit = () => {
        setErrors({});
        setDraft({
            firstName: apiUser?.firstName ?? "",
            lastName: apiUser?.lastName ?? "",
            phoneNumber: formatPhoneDisplay(apiUser?.phone ?? ""),
            gender: apiUser?.gender ?? "",
            dateOfBirth: dateOfBirth
                ? new Date(dateOfBirth).toISOString().slice(0, 10)
                : "",
        });
        setIsEditOpen(true);
    };

    const handleSave = () => {
        const payload = {
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            phoneNumber: toE164(draft.phoneNumber),
            gender: (draft.gender as "male" | "female") || undefined,
            dateOfBirth: draft.dateOfBirth
                ? new Date(`${draft.dateOfBirth}T00:00:00`)
                : undefined,
        };

        const fieldErrors = zodFieldErrors(ProfileEditSchema, payload);
        if (fieldErrors) {
            setErrors(fieldErrors);
            return;
        }

        setErrors({});
        updateProfile.mutate(payload);
    };

    if (isPending) {
        return (
            <div className="w-full min-w-0 max-w-3xl">
                <div className="flex flex-col gap-4">
                    <div className="h-16 animate-pulse rounded bg-muted" />
                    <div className="h-16 animate-pulse rounded bg-muted" />
                    <div className="h-16 animate-pulse rounded bg-muted" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full min-w-0 max-w-3xl">
            <Row
                label="Photo"
                required
                description="This will be displayed on your profile."
            >
                {photoSrc ? (
                    <Image
                        src={photoSrc}
                        alt={name}
                        width={80}
                        height={80}
                        className="h-20 w-20 shrink-0 rounded-full border border-border object-cover"
                    />
                ) : (
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
                        {initials}
                    </span>
                )}
            </Row>
            <Row
                label="Full name"
                required
                description="This will be displayed on your profile."
            >
                <span className="text-sm text-foreground">{name}</span>
                <EditLink onClick={openEdit} />
            </Row>
            <Row
                label="Contact email"
                required
                description="Where you'll receive booking updates."
            >
                <span className="flex items-center gap-1.5">
                    <span className="text-sm text-foreground">{email}</span>
                    {emailVerified && <VerifiedBadge />}
                </span>
            </Row>
            <Row
                label="Phone"
                required
                description="Your contact phone number."
            >
                <span className="text-sm text-foreground">{phone ? formatPhoneDisplay(phone) : "Not set"}</span>
                <EditLink onClick={openEdit} />
            </Row>
            <Row label="Gender" description="Your gender.">
                <span className="text-sm text-foreground">{gender ?? "Not set"}</span>
                <EditLink onClick={openEdit} />
            </Row>
            <Row label="Date of birth" description="Your date of birth." isLast>
                <span className="text-sm text-foreground">{displayDate}</span>
                <EditLink onClick={openEdit} />
            </Row>

            <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DrawerContent>
                    <div className="mx-auto w-full max-w-lg">
                    <DrawerHeader className="sm:text-left">
                        <DrawerTitle>Update profile</DrawerTitle>
                        <DrawerDescription>
                            Edit your personal information.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="flex flex-col gap-4 px-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field
                                label="First name"
                                htmlFor="edit-firstName"
                                error={errors.firstName}
                            >
                                <Input
                                    id="edit-firstName"
                                    value={draft.firstName}
                                    onChange={(event) =>
                                        updateDraft("firstName", event.target.value)
                                    }
                                />
                            </Field>
                            <Field
                                label="Last name"
                                htmlFor="edit-lastName"
                                error={errors.lastName}
                            >
                                <Input
                                    id="edit-lastName"
                                    value={draft.lastName}
                                    onChange={(event) =>
                                        updateDraft("lastName", event.target.value)
                                    }
                                />
                            </Field>
                        </div>
                        <Field label="Phone" htmlFor="edit-phone" error={errors.phoneNumber}>
                            <Input
                                id="edit-phone"
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel"
                                placeholder={PHONE_PLACEHOLDER}
                                value={draft.phoneNumber}
                                onChange={(event) =>
                                    updateDraft(
                                        "phoneNumber",
                                        formatPhoneDisplay(event.target.value),
                                    )
                                }
                            />
                        </Field>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Gender" htmlFor="edit-gender" error={errors.gender}>
                                <Select
                                    id="edit-gender"
                                    value={draft.gender}
                                    onChange={(event) =>
                                        updateDraft("gender", event.target.value)
                                    }
                                >
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </Select>
                            </Field>
                            <Field
                                label="Date of birth"
                                htmlFor="edit-dateOfBirth"
                                error={errors.dateOfBirth}
                            >
                                <Input
                                    id="edit-dateOfBirth"
                                    type="date"
                                    value={draft.dateOfBirth}
                                    onChange={(event) =>
                                        updateDraft("dateOfBirth", event.target.value)
                                    }
                                />
                            </Field>
                        </div>
                    </div>
                    </div>
                    <DrawerFooter>
                        {updateProfile.isError && (
                            <p className="w-full text-center text-sm text-destructive">
                                {getApiErrorMessage(
                                    updateProfile.error,
                                    "Something went wrong. Please try again.",
                                )}
                            </p>
                        )}
                        <Button
                            type="submit"
                            onClick={handleSave}
                            pill
                            disabled={updateProfile.isPending}
                            className="font-semibold text-sm"
                        >
                            Save changes
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    );
};

export { ProfileCard };