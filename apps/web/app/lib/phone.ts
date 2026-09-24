export const PHONE_PLACEHOLDER = "+234 801 000 0000";

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return (digits.startsWith("0") ? `234${digits.slice(1)}` : digits).slice(
    0,
    13,
  );
}

export function isValidNigerianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return (
    (digits.startsWith("0") && digits.length === 11) ||
    (digits.startsWith("234") && digits.length === 13)
  );
}

export function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, "");
  const normalized = (digits.startsWith("0") ? `234${digits.slice(1)}` : digits).slice(
    0,
    13,
  );
  if (normalized.length < 12 || !normalized.startsWith("234")) return value.trim();
  return `+234 ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
}

export function toE164(value: string): string {
  return `+${normalizePhone(value)}`;
}