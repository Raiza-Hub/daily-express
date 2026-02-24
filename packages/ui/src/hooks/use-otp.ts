// components/otp/useOTP.ts

import { useEffect, useRef, useState } from "react";

interface UseOTPOptions {
  length: number;
  disabled: boolean;
  onComplete?: (value: string) => void;
  onValueChange?: (value: string) => void;
}

export const useOTP = ({
  length,
  disabled,
  onComplete,
  onValueChange,
}: UseOTPOptions) => {
  const [values, setValues] = useState<string[]>(
    Array.from({ length }, () => "")
  );

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const updateValues = (newValues: string[]) => {
    setValues(newValues);
    const joined = newValues.join("");
    onValueChange?.(joined);

    if (newValues.every((v) => v !== "") && newValues.length === length) {
      onComplete?.(joined);
    }
  };

  const handleChange = (index: number, rawValue: string) => {
    if (disabled) return;

    const value = rawValue.replace(/\D/g, "").slice(-1);

    const newValues = [...values];
    newValues[index] = value;

    updateValues(newValues);

    if (value && index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (disabled) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      const newValues = [...values];

      if (values[index]) {
        newValues[index] = "";
      } else if (index > 0) {
        newValues[index - 1] = "";
        focusInput(index - 1);
      }

      updateValues(newValues);
    }

    if (e.key === "ArrowLeft" && index > 0) {
      focusInput(index - 1);
    }

    if (e.key === "ArrowRight" && index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    e.preventDefault();

    const pasted = e.clipboardData
      .getData("text/plain")
      .replace(/\D/g, "")
      .slice(0, length)
      .split("");

    const newValues = Array.from({ length }, (_, i) => pasted[i] ?? "");

    updateValues(newValues);

    const nextEmpty = newValues.findIndex((v) => v === "");
    focusInput(nextEmpty !== -1 ? nextEmpty : length - 1);
  };

  const handleFocus = (index: number) => {
    inputRefs.current[index]?.select();
  };

  return {
    values,
    inputRefs,
    handleChange,
    handleKeyDown,
    handlePaste,
    handleFocus,
  };
};
