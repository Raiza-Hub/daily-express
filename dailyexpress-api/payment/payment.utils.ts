export function enrichWithExpiry<T>(
  paymentRecord: T,
  expiresAt?: Date | null,
): T & { expiresAt: Date | null } {
  return { ...paymentRecord, expiresAt: expiresAt ?? null };
}
