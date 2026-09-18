"use client";

import * as React from "react";
import { cn } from "@repo/ui/lib/utils";

const buttonVariants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-border bg-background text-foreground hover:bg-accent",
};

const buttonSizes = {
    default: "h-10 px-4 py-2",
    sm: "h-8 px-3 text-sm",
    lg: "h-11 px-8",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: keyof typeof buttonVariants;
    size?: keyof typeof buttonSizes;
    pill?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = "", variant = "default", size = "default", pill = false, type, ...props }, ref) => (
        <button
            ref={ref}
            type={type ?? "button"}
            className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none",
                pill ? "rounded-full" : "rounded-md",
                buttonVariants[variant],
                buttonSizes[size],
                className,
            )}
            {...props}
        />
    ),
);
Button.displayName = "Button";

export { Button, buttonVariants, buttonSizes };