"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
    confirmProfileUploadFn,
    presignProfileUploadFn,
    uploadToR2Fn,
    useQueryClient,
} from "@repo/api";
import type { Driver } from "@shared/types";
import { Row, EditLink } from "../user/settings-shared";

interface DriverPhotoRowProps {
    profilePic?: string | null;
    name: string;
    initials: string;
}

const DriverPhotoRow = ({ profilePic, name, initials }: DriverPhotoRowProps) => {
    const queryClient = useQueryClient();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const photoSrc = photoPreview ?? profilePic ?? null;

    useEffect(() => {
        return () => {
            if (photoPreview) URL.revokeObjectURL(photoPreview);
        };
    }, [photoPreview]);

    const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setPhotoPreview(URL.createObjectURL(file));
        setPendingPhoto(file);
    };

    const handlePhotoSave = async () => {
        if (!pendingPhoto || isUploading) return;

        setIsUploading(true);
        try {
            const { uploadUrl, key } = await presignProfileUploadFn(
                pendingPhoto.type || "image/jpeg",
                pendingPhoto.size,
            );
            await uploadToR2Fn(uploadUrl, pendingPhoto);
            const { profile_pic } = await confirmProfileUploadFn(key);
            queryClient.setQueryData<Driver | null>(["driver"], (current) =>
                current ? { ...current, profile_pic } : current,
            );
            setPendingPhoto(null);
            setPhotoPreview(null);
        } catch {
            toast.error("We couldn't upload that photo. Please try again.");
            setPendingPhoto(null);
            setPhotoPreview(null);
        } finally {
            setIsUploading(false);
        }
    };

    const handlePhotoDelete = () => {
        setPendingPhoto(null);
        setPhotoPreview(null);
    };

    return (
        <Row
            label="Photo"
            required
            description="This will be displayed on your driver profile."
        >
            {photoSrc ? (
                <Image
                    src={photoSrc}
                    alt={name}
                    width={80}
                    height={80}
                    unoptimized={photoPreview !== null}
                    aria-busy={isUploading}
                    className={`h-20 w-20 shrink-0 rounded-full border border-border object-cover ${
                        isUploading ? "animate-pulse opacity-70" : ""
                    }`}
                />
            ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
                    {initials}
                </span>
            )}
            <span className="ml-2 flex items-center gap-2">
                <button
                    type="button"
                    onClick={handlePhotoDelete}
                    disabled={!pendingPhoto || isUploading}
                    className={`cursor-pointer text-sm disabled:cursor-default disabled:opacity-40 ${
                        pendingPhoto
                            ? "text-destructive hover:text-destructive/80"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Delete
                </button>
                <EditLink
                    onClick={
                        pendingPhoto
                            ? () => void handlePhotoSave()
                            : () => fileInputRef.current?.click()
                    }
                    ariaDisabled={isUploading}
                >
                    {pendingPhoto ? "Save" : "Upload"}
                </EditLink>
            </span>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={isUploading}
                className="hidden"
            />
        </Row>
    );
};

export { DriverPhotoRow };
