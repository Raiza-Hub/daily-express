import { randomUUID } from "node:crypto";
import {
  createDriverBankVerificationFailedEvent,
  createDriverBankVerifiedEvent,
  createPayoutCompletedEvent,
  createPayoutFailedEvent,
  TOPICS,
  type PayoutCompletedEvent,
  type PayoutFailedEvent,
  type DriverBankVerifiedEvent,
  type DriverBankVerificationFailedEvent,
} from "@shared/kafka";
import { db } from "../../db/db";
import { outboxEvents } from "../../db/schema";

type OutboxEvent =
  | PayoutCompletedEvent
  | PayoutFailedEvent
  | DriverBankVerifiedEvent
  | DriverBankVerificationFailedEvent;

export async function emitPayoutCompleted(input: {
  payoutId: string;
  driverId: string;
  reference: string;
  amountMinor: number;
  currency: string;
}) {
  const topic = TOPICS.PAYOUT_COMPLETED;
  const event = createPayoutCompletedEvent({
    eventId: randomUUID(),
    source: "payout-service",
    ...input,
  });
  await insertOutboxEvent(event, topic, input.payoutId);
}

export async function emitPayoutFailed(input: {
  payoutId: string;
  driverId: string;
  driverEmail: string;
  driverName: string | null;
  reference: string;
  amountMinor: number;
  koraFeeAmount: number;
  currency: string;
  failureReason?: string | null;
  bankName: string;
  accountLast4: string;
}) {
  const topic = TOPICS.PAYOUT_FAILED;
  const event = createPayoutFailedEvent({
    eventId: randomUUID(),
    source: "payout-service",
    ...input,
  });
  await insertOutboxEvent(event, topic, input.payoutId);
}

export async function emitDriverBankVerified(input: {
  driverId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  currency: string;
}) {
  const topic = TOPICS.DRIVER_BANK_VERIFIED;
  const event = createDriverBankVerifiedEvent({
    eventId: randomUUID(),
    source: "payout-service",
    ...input,
  });
  await insertOutboxEvent(event, topic, input.driverId);
}

export async function emitDriverBankVerificationFailed(input: {
  driverId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  reason?: string | null;
  currency: string;
}) {
  const topic = TOPICS.DRIVER_BANK_VERIFICATION_FAILED;
  const event = createDriverBankVerificationFailedEvent({
    eventId: randomUUID(),
    source: "payout-service",
    ...input,
  });
  await insertOutboxEvent(event, topic, input.driverId);
}

async function insertOutboxEvent(
  event: OutboxEvent,
  topic: string,
  aggregateId: string,
): Promise<void> {
  await db.insert(outboxEvents).values({
    eventId: event.eventId,
    aggregateType: topic,
    aggregateId: aggregateId,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    payload: event,
    traceId: event.traceId,
    spanId: event.spanId,
  });
}
