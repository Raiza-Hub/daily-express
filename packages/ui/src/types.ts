import type { ClipboardEvent, KeyboardEvent, ReactNode } from "react";

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
  onKeyDown: (index: number, e: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  onFocus: (index: number) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}

export interface ResponsiveModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  dialogClassName?: string;
  panelClassName?: string;
}
