import type { Dispatch, SetStateAction } from "react";

export function createDraftUpdater<T extends Record<string, string>>(
    setDraft: Dispatch<SetStateAction<T>>,
    setErrors: Dispatch<SetStateAction<Record<string, string>>>,
) {
    return (key: keyof T, value: T[keyof T]): void => {
        setDraft((current) => ({ ...current, [key]: value }));
        const errorKey = key as string;
        setErrors((current) => {
            if (!current[errorKey]) return current;
            const next = { ...current };
            delete next[errorKey];
            return next;
        });
    };
}