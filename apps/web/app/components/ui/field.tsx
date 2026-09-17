"use client";

import * as React from "react";

interface FieldProps {
    label: string;
    htmlFor?: string;
    error?: string;
    children: React.ReactNode;
    className?: string;
}

const Field = ({ label, htmlFor, error, children, className = "" }: FieldProps) => (
    <div className={`flex flex-col gap-2 ${className}`}>
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
            {label}
        </label>
        {children}
        {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
);

export { Field };