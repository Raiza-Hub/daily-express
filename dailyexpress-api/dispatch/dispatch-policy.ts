export type CallOutcome = "declined" | "unavailable";

const CALL_RETRY_DELAY_MS = 60 * 1_000;
export const MAX_CALL_RETRIES = 2;

const RETRYABLE_HANGUP_CAUSES = new Set([
  "USER_BUSY",
  "NO_ANSWER",
  "NO_USER_RESPONSE",
  "NORMAL_TEMPORARY_FAILURE",
  "SUBSCRIBER_ABSENT",
  "SERVICE_UNAVAILABLE",
  "UNALLOCATED_NUMBER",
  "USER_NOT_REGISTERED",
  "RECOVERY_ON_TIMER_EXPIRE",
  "ORIGINATOR_CANCEL",
  "LOSE_RACE",
]);

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CURRENCY_NAMES: Record<string, string> = {
  NGN: "naira",
  USD: "dollars",
  EUR: "euros",
  GBP: "pounds",
  KES: "kenyan shillings",
  GHS: "cedis",
  ZAR: "rand",
};

export function classifyCallOutcome(input: {
  status?: string;
  hangupCause?: string;
}): CallOutcome {
  const cause = input.hangupCause?.trim().toUpperCase();
  if (cause && RETRYABLE_HANGUP_CAUSES.has(cause)) return "unavailable";

  const status = input.status
    ?.trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (status === "notanswered") return "unavailable";

  return "declined";
}

export function nextCallRetryAt(input: {
  outcome: CallOutcome;
  retryNumber: number;
  now: Date;
  deadlineAt: Date | null;
}): Date | null {
  if (
    input.outcome !== "unavailable" ||
    input.retryNumber >= MAX_CALL_RETRIES ||
    !input.deadlineAt
  ) {
    return null;
  }

  const retryAt = new Date(input.now.getTime() + CALL_RETRY_DELAY_MS);
  return retryAt.getTime() < input.deadlineAt.getTime() ? retryAt : null;
}

export function formatTripDate(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateKey.trim());
  if (!match) return dateKey;

  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  const monthName = MONTHS[monthIndex];
  if (!monthName) return dateKey;

  const parsed = new Date(
    Date.UTC(Number(year), monthIndex, Number(day), 12, 0, 0),
  );
  const weekday = WEEKDAYS[parsed.getUTCDay()];
  return `${weekday} ${Number(day)} ${monthName}`;
}

export function formatDepartureTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return time;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return time;

  const period =
    hour < 12 ? "in the morning" : hour < 17 ? "in the afternoon" : "in the evening";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  if (minute === 0) return `${hour12} ${period}`;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export function formatOfferAmount(amount: number, currency: string): string {
  const rounded = Math.round(amount);
  const grouped = new Intl.NumberFormat("en-NG", {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(rounded);
  return `${grouped} ${CURRENCY_NAMES[currency.toUpperCase()] ?? currency}`;
}

export function buildOfferPrompt(input: {
  originTitle: string;
  destinationTitle: string;
  meetingPoint: string;
  tripDate: string;
  departureTime: string;
  amount: number;
  currency: string;
  bookedSeats: number;
  capacity: number;
}): string {
  const route = `${input.originTitle} to ${input.destinationTitle}`;
  const when = `${formatTripDate(input.tripDate)} at ${formatDepartureTime(input.departureTime)}`;
  const pay = `${formatOfferAmount(input.amount, input.currency)} for ${input.bookedSeats} of ${input.capacity} seats`;

  return [
    "You have a Daily Express trip offer.",
    `${route}.`,
    `${when}.`,
    `Pickup is at ${input.meetingPoint}.`,
    `The trip currently pays ${pay}.`,
    "More passengers can still join.",
    "Press 1 to accept.",
    "Press 2 to decline.",
  ].join(" ");
}