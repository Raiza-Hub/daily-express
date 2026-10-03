"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "@repo/ui/lib/utils";

interface SelectItem {
    value: string;
    label: string;
    disabled?: boolean;
}

interface SelectProps {
    items: SelectItem[];
    value: string;
    onChange: (value: string) => void;
    invalid?: boolean;
    disabled?: boolean;
    id?: string;
    name?: string;
    required?: boolean;
    placeholder?: string;
    className?: string;
    iconClassName?: string;
    "aria-label"?: string;
}

const SelectPopup = ({ items }: { items: SelectItem[] }) => {
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Positioner
                sideOffset={4}
                alignItemWithTrigger={false}
                className="z-50"
            >
                <SelectPrimitive.Popup className="max-h-72 w-max min-w-(--anchor-width) origin-top rounded-md border border-border bg-popover text-popover-foreground shadow-md">
                    <SelectPrimitive.List className="max-h-72 overflow-y-auto p-1">
                        {items.map((item) => (
                            <SelectPrimitive.Item
                                key={item.value}
                                value={item.value}
                                disabled={item.disabled}
                                className="relative flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                            >
                                <SelectPrimitive.ItemIndicator className="absolute left-2 flex">
                                    <Check className="h-4 w-4" />
                                </SelectPrimitive.ItemIndicator>
                                <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
                            </SelectPrimitive.Item>
                        ))}
                    </SelectPrimitive.List>
                </SelectPrimitive.Popup>
            </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
    );
};

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
    (
        {
            className,
            iconClassName,
            invalid = false,
            items,
            value,
            onChange,
            disabled,
            id,
            name,
            required,
            placeholder,
            "aria-label": ariaLabel,
        },
        ref,
    ) => (
        <SelectPrimitive.Root
            items={items}
            value={value}
            onValueChange={(next) => {
                if (next !== null) onChange(String(next));
            }}
            disabled={disabled}
            name={name}
            required={required}
        >
            <SelectPrimitive.Trigger
                ref={ref}
                id={id}
                aria-label={ariaLabel}
                className={cn(
                    "relative flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-3 pr-9 text-left text-sm text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[popup-open]:border-ring disabled:opacity-50",
                    invalid ? "border-destructive" : "border-border",
                    className,
                )}
            >
                <SelectPrimitive.Value className="truncate" placeholder={placeholder} />
                <SelectPrimitive.Icon
                    className={cn(
                        "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground",
                        iconClassName,
                    )}
                >
                    <ChevronDown className="h-4 w-4" />
                </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>
            <SelectPopup items={items} />
        </SelectPrimitive.Root>
    ),
);
Select.displayName = "Select";

export { Select };
export type { SelectItem };