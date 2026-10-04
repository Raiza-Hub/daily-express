"use client";

import * as React from "react";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";
import { cn } from "@repo/ui/lib/utils";

interface RadioGroupProps<Value extends string> {
    name: string;
    legend: string;
    options: { value: Value; label: string }[];
    value: Value | "";
    onValueChange: (value: Value | "") => void;
    className?: string;
}

const RadioGroup = <Value extends string>({
    name,
    legend,
    options,
    value,
    onValueChange,
    className,
}: RadioGroupProps<Value>) => (
    <FieldPrimitive.Root name={name} className={cn("flex flex-col", className)}>
        <fieldset className="flex flex-col">
            <legend className="mb-3 text-sm font-medium text-foreground">
                {legend}
            </legend>
            <RadioGroupPrimitive
                value={value}
                onValueChange={onValueChange}
                className="flex flex-col gap-3"
            >
                {options.map((option) => (
                    <label
                        key={option.value}
                        className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                    >
                        <Radio.Root
                            value={option.value}
                            className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-background transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[checked]:border-primary data-[invalid]:border-destructive"
                        >
                            <Radio.Indicator className="flex">
                                <span className="h-2 w-2 rounded-full bg-primary" />
                            </Radio.Indicator>
                        </Radio.Root>
                        {option.label}
                    </label>
                ))}
            </RadioGroupPrimitive>
        </fieldset>
        <FieldPrimitive.Error className="mt-2 text-sm text-destructive" />
    </FieldPrimitive.Root>
);

export { RadioGroup };