import { createServiceError } from "@shared/utils";
import { KoraChannel } from "../payment/payment.types";
import type { WebhookJobData } from "../workers/boss";
const CHECKOUT_FEE_RATE = 0.1;
const MAX_CHECKOUT_AMOUNT = 200_000;

export function dedupeChannels(channels?: KoraChannel[]) {
  if (!channels?.length) {
    return null;
  }

  const uniqueChannels: KoraChannel[] = [];
  for (const channel of channels) {
    if (!uniqueChannels.includes(channel)) {
      uniqueChannels.push(channel);
    }
  }

  return uniqueChannels;
}

export function normalizeAmount(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  return null;
}

export function parseDate(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateTrustedChargeAmount(fareAmount: number) {
  return Math.round(fareAmount * (1 + CHECKOUT_FEE_RATE));
}

export function assertCheckoutAmountWithinLimit(amount: number) {
  if (amount > MAX_CHECKOUT_AMOUNT) {
    throw createServiceError("Checkout amount exceeds NGN 200,000 limit", 400);
  }
}

export function toMinorAmount(amount: number) {
  return Math.round(amount * 100);
}

export function formatMajorAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatTripDate(value: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

export function formatTripTime(value: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function getPaymentReference(job: WebhookJobData) {
  if (job.event.startsWith("refund.")) {
    return (
      (job.data.payment_reference as string | undefined) ||
      (job.data.reference as string | undefined) ||
      null
    );
  }

  return (
    (job.data.reference as string | undefined) ||
    (job.data.payment_reference as string | undefined) ||
    null
  );
}
