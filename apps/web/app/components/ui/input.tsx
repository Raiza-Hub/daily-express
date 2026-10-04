"use client";

import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@repo/ui/lib/utils";
import { fieldControlStyles } from "./field-styles";

type InputProps = Omit<React.ComponentPropsWithRef<"input">, "ref">;

const Input = ({ className, ...props }: InputProps) => (
    <InputPrimitive className={cn(fieldControlStyles, className)} {...props} />
);

export { Input };