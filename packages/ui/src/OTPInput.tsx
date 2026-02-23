// components/otp/OTPInput.tsx

import React from "react";
import { OTPInputProps } from "@repo/types";
import { useOTP } from "./hooks/use-otp";
import { OTPInputField } from "./components/otp-input-field";


export const OTPInput: React.FC<OTPInputProps> = ({
    length = 6,
    onComplete,
    onValueChange,
    disabled = false,
    error = false,
    className = "",
}) => {
    const {
        values,
        inputRefs,
        handleChange,
        handleKeyDown,
        handlePaste,
        handleFocus,
    } = useOTP({
        length,
        disabled,
        onComplete,
        onValueChange,
    });

    return (
        <div className={`flex gap-2 ${className}`}>
            {values.map((value, index) => (
                <OTPInputField
                    key={index}
                    value={value}
                    index={index}
                    disabled={disabled}
                    error={error}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onFocus={handleFocus}
                    inputRef={(el) => (inputRefs.current[index] = el)}
                />
            ))}
        </div>
    );
};
