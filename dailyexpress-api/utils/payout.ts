export const KORA_ERROR_CODES = {
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
} as const;

export function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
  }).format(amount);
}
