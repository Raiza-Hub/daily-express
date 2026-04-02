import { randomUUID } from "node:crypto";
import {
  TOPICS,
  createPaymentCompletedEvent,
  createPaymentFailedEvent,
  encodeEvent,
  getProducer,
} from "@shared/kafka";

export async function emitPaymentCompleted(input: {
  paymentId: string;
  bookingId: string;
  paymentReference: string;
}) {
  const producer = await getProducer();
  const event = createPaymentCompletedEvent({
    eventId: randomUUID(),
    source: "payment-service",
    paymentId: input.paymentId,
    bookingId: input.bookingId,
    paymentReference: input.paymentReference,
  });

  const encoded = await encodeEvent(event.eventType, event);

  await producer.send({
    topic: TOPICS.PAYMENT_COMPLETED,
    messages: [
      {
        key: input.bookingId,
        value: encoded,
      },
    ],
  });
}

export async function emitPaymentFailed(input: {
  paymentId: string;
  bookingId: string;
  paymentReference: string;
  paymentStatus: "failed" | "cancelled" | "expired";
  failureReason?: string | null;
}) {
  const producer = await getProducer();
  const event = createPaymentFailedEvent({
    eventId: randomUUID(),
    source: "payment-service",
    paymentId: input.paymentId,
    bookingId: input.bookingId,
    paymentReference: input.paymentReference,
    paymentStatus: input.paymentStatus,
    failureReason: input.failureReason,
  });

  const encoded = await encodeEvent(event.eventType, event);

  await producer.send({
    topic: TOPICS.PAYMENT_FAILED,
    messages: [
      {
        key: input.bookingId,
        value: encoded,
      },
    ],
  });
}
