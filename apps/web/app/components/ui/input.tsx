"use client";

import * as React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = "", invalid = false, ...props }, ref) => (
        <input
            ref={ref}
            className={`h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 ${
                invalid ? "border-destructive" : "border-border"
            } ${className}`}
            {...props}
        />
    ),
);
Input.displayName = "Input";

export { Input };