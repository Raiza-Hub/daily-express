export type TripBookingStatus =
  | "confirmed"
  | "refunded"
  | "refund_pending"
  | "refund_failed";

export const STATUS_LABELS: Record<TripBookingStatus, string> = {
  confirmed: "Confirmed",
  refunded: "Refunded",
  refund_pending: "Refund pending",
  refund_failed: "Refund failed",
};

export function deriveTripBookingStatus(
  refundStatus: string | null | undefined,
): TripBookingStatus {
  switch (refundStatus) {
    case "successful":
      return "refunded";
    case "pending":
      return "refund_pending";
    case "failed":
      return "refund_failed";
    default:
      return "confirmed";
  }
}

export function remainingPassengerCount(
  capacity: number,
  bookedSeats: number,
): number {
  return Math.max(capacity - bookedSeats, 0);
}

export function remainingPassengerCopy(
  capacity: number,
  bookedSeats: number,
): string | null {
  const remaining = remainingPassengerCount(capacity, bookedSeats);
  if (remaining === 0) return null;
  const noun = remaining === 1 ? "passenger remains" : "passengers remain";
  return `${remaining} ${noun} before we dispatch.`;
}

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return "";
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return trimmed;
  return `${trimmed[0]}***${trimmed.slice(at)}`;
}

const ORIGIN_IMAGES: Record<string, string> = {
  "professor wole soyinka station abeokuta":
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ9_UWDZc4aGxU0PkEesuZ8lT8NEH0M79Rdv-TfDAPunJ_qZRhgn6-n-Lw&s=10",
};

export function getOriginImage(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const key = title.trim().toLowerCase().replace(/\s+/g, " ");
  return ORIGIN_IMAGES[key];
}