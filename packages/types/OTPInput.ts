// components/otp/types.ts

export interface OTPInputProps {
  length?: number;
  onComplete?: (value: string) => void;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  className?: string;
}

export interface OTPInputFieldProps {
  value: string;
  index: number;
  disabled: boolean;
  error: boolean;
  onChange: (index: number, value: string) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onFocus: (index: number) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}
