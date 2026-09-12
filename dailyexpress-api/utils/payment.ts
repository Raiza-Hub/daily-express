import { randomInt } from "node:crypto";
import type { KoraCheckoutChannel } from "@shared/types";
import type { WebhookJobData } from "../workers/boss";

type KoraChannel = KoraCheckoutChannel;

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

export function calculateTripChargeAmount(input: {
  totalAmount: number;
  totalFee: number;
}) {
  return input.totalAmount + input.totalFee;
}

export function getPaymentReference(job: WebhookJobData) {
  return typeof job.data.reference === "string" ? job.data.reference : null;
}
