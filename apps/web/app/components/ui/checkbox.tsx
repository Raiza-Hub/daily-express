"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import { Check } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface CheckboxProps {
    name?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    children: React.ReactNode;
    disabled?: boolean;
    className?: string;
}

const Checkbox = ({
    name,
    checked,
    onCheckedChange,
    disabled,
    className,
    children,
}: CheckboxProps) => (
    <FieldPrimitive.Root
        name={name}
        className={cn("flex flex-col gap-2", className)}
    >
        <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
            <CheckboxPrimitive.Root
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={disabled}
                className="mt-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-border bg-background transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[checked]:border-primary data-[checked]:bg-primary data-[invalid]:border-destructive data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
            >
                <CheckboxPrimitive.Indicator className="flex text-primary-foreground">
                    <Check className="h-3 w-3" aria-hidden />
                </CheckboxPrimitive.Indicator>
            </CheckboxPrimitive.Root>
            <span>{children}</span>
        </label>
        <FieldPrimitive.Error className="text-sm text-destructive" />
    </FieldPrimitive.Root>
);

export { Checkbox };