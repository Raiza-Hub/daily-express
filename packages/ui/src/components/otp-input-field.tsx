// components/otp/OTPInputField.tsx

import React from "react";
import { OTPInputFieldProps } from "@repo/types";

export const OTPInputField: React.FC<OTPInputFieldProps> = ({
    value,
    index,
    disabled,
    error,
    onChange,
    onKeyDown,
    onPaste,
    onFocus,
    inputRef,
}) => {
    return (
        <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(index, e.target.value)}
            onKeyDown={(e) => onKeyDown(index, e)}
            onPaste={onPaste}
            onFocus={() => onFocus(index)}
            className={`
        w-10 h-12 text-center text-lg font-medium rounded-md border
        transition-colors duration-200
        focus:outline-none focus:ring-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${error
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:ring-blue-500"
                }
      `}
        />
    );
};
