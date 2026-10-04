"use client";

import * as React from "react";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import { cn } from "@repo/ui/lib/utils";

interface FieldProps {
    name: string;
    label: string;
    children: React.ReactNode;
    className?: string;
}

const Field = ({ name, label, className, children }: FieldProps) => (
    <FieldPrimitive.Root
        name={name}
        className={cn("flex flex-col gap-2", className)}
    >
        <FieldPrimitive.Label className="text-sm font-medium text-foreground">
            {label}
        </FieldPrimitive.Label>
        {children}
        <FieldPrimitive.Error className="text-sm text-destructive" />
    </FieldPrimitive.Root>
);

Field.Control = FieldPrimitive.Control;

export { Field };