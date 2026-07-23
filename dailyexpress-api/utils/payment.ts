import { createServiceError } from "@shared/utils";
import { randomInt } from "node:crypto";
import type { KoraCheckoutChannel } from "@shared/types";
import type { WebhookJobData } from "../workers/boss";

type KoraChannel = KoraCheckoutChannel;
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

export function generateReference(): string {
  const now = new Date();
  const yymmdd =
    now.getFullYear().toString().slice(-2) +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0");
  const hhmmss =
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0") +
    now.getSeconds().toString().padStart(2, "0");
  const random = randomInt(0, 10 ** 12).toString().padStart(12, "0");
  return `${yymmdd}${hhmmss}${random}`;
}

export function parseDate(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateTrustedChargeAmount(fareAmount: number, feeAmount: number = 0) {
  return fareAmount + feeAmount;
}

export function assertCheckoutAmountWithinLimit(amount: number) {
  if (amount > MAX_CHECKOUT_AMOUNT) {
    throw createServiceError("Checkout amount exceeds NGN 200,000 limit", 400);
  }
}

export function toMinorAmount(amount: number) {
  return Math.round(amount * 100);
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
