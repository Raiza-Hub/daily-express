"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    invalid?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className = "", invalid = false, children, ...props }, ref) => (
        <div className="relative">
            <select
                ref={ref}
                className={`h-10 w-full cursor-pointer appearance-none rounded-md border bg-background px-3 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 ${
                    invalid ? "border-destructive" : "border-border"
                } ${className}`}
                {...props}
            >
                {children}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
    ),
);
Select.displayName = "Select";

export { Select };