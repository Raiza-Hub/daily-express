import { randomUUID } from "node:crypto";
import {
  createNotificationEmailEvent,
  createPaymentCompletedEvent,
  createPaymentFailedEvent,
  type NotificationEmailRequestedEvent,
  type PaymentCompletedEvent,
  type PaymentFailedEvent,
} from "@shared/kafka";
import { db } from "../../db/db";
import { outboxEvents } from "../../db/schema";
import { logger } from "@shared/logger";

type OutboxEvent =
  | NotificationEmailRequestedEvent
  | PaymentCompletedEvent
  | PaymentFailedEvent;

interface EmailNotificationPayload {
  to: string;
  subject: string;
  html?: string;
  template?: string;
  propsJson?: string;
}

export async function emitPaymentCompleted(input: {
  paymentId: string;
  bookingId?: string | null;
  paymentReference: string;
  paidAt?: string | null;
  userEmail?: string;
}): Promise<void> {
  const event = createPaymentCompletedEvent({
    eventId: randomUUID(),
    source: "payment-service",
    paymentId: input.paymentId,
    bookingId: input.bookingId,
    paymentReference: input.paymentReference,
    paidAt: input.paidAt ?? null,
    userEmail: input.userEmail,
  });

  const topic = "payment.completed";
  await insertOutboxEvent(event, topic, input.paymentReference);
}

export async function emitPaymentFailed(input: {
  paymentId: string;
  bookingId?: string | null;
  paymentReference: string;
  paymentStatus: "failed" | "cancelled" | "expired";
  failureReason?: string | null;
}): Promise<void> {
  const event = createPaymentFailedEvent({
    eventId: randomUUID(),
    source: "payment-service",
    paymentId: input.paymentId,
    bookingId: input.bookingId,
    paymentReference: input.paymentReference,
    paymentStatus: input.paymentStatus,
    failureReason: input.failureReason,
  });

  const topic = "payment.failed";
  await insertOutboxEvent(event, topic, input.paymentReference);
}

export async function sendRefundFailedNotification(
  payload: EmailNotificationPayload,
): Promise<void> {
  const topic = "notification.email.send";
  const event = createNotificationEmailEvent({
    eventId: randomUUID(),
    source: "payment-service",
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    template: payload.template,
    propsJson: payload.propsJson,
  });

  await insertOutboxEvent(event, topic, payload.to);
}


async function insertOutboxEvent(
  event: OutboxEvent,
  topic: string,
  aggregateId: string,
  extra?: Record<string, unknown>,
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

  logger.info("kafka.outbox_event_created", {
    eventId: event.eventId,
    topic: topic,
    aggregateId: aggregateId,
    ...extra,
  });
}
