import { randomUUID } from "node:crypto";
import {
  createBookingCancelledEvent,
  createBookingConfirmedEvent,
  createBookingCreatedEvent,
  createNotificationEmailEvent,
  createRouteCreatedEvent,
  createRouteDeletedEvent,
  createTripCancelledEvent,
  createTripCompletedEvent,
  type BookingConfirmedEvent,
  type BookingCancelledEvent,
  type BookingCreatedEvent,
  type RouteCreatedEvent,
  type RouteDeletedEvent,
  type TripCompletedEvent,
  type TripCancelledEvent,
  type NotificationEmailRequestedEvent,
} from "@shared/kafka";
import { db } from "../../db/db";
import { outboxEvents } from "../../db/schema";
import { logger } from "@shared/logger";

type OutboxEvent =
  | BookingConfirmedEvent
  | BookingCancelledEvent
  | BookingCreatedEvent
  | RouteCreatedEvent
  | RouteDeletedEvent
  | TripCompletedEvent
  | TripCancelledEvent
  | NotificationEmailRequestedEvent;

interface RouteCreatedPayload {
  routeId: string;
  driverId: string;
  origin: string;
  destination: string;
  departureTime: string | Date;
}

interface RouteDeletedPayload {
  routeId: string;
  driverId: string;
}

interface BookingConfirmedPayload {
  bookingId: string;
  tripId: string;
  routeId: string;
  driverId: string;
  userId: string;
  passengerName: string | null;
  pickupTitle: string;
  dropoffTitle: string;
  seatNumber: number;
  fareAmountMinor: number;
  currency: string;
  paymentReference: string;
  tripDate: string;
  departureTime: string;
}

interface BookingCancelledPayload {
  bookingId: string;
  tripId: string;
  routeId: string;
  driverId: string;
  paymentReference?: string | null;
}

interface TripCompletedPayload {
  tripId: string;
  driverId: string;
  pickupTitle: string;
  dropoffTitle: string;
  tripDate: string;
}

interface TripStatusPayload {
  tripId: string;
  driverId: string;
}

interface EmailNotificationPayload {
  to: string;
  subject: string;
  html?: string;
  template?: string;
  propsJson?: string;
}

export async function emitRouteCreated(payload: RouteCreatedPayload) {
  const topic = "route.created";
  const event = createRouteCreatedEvent({
    eventId: randomUUID(),
    source: "route-service",
    routeId: payload.routeId,
    driverId: payload.driverId,
    origin: payload.origin,
    destination: payload.destination,
    departureTime:
      payload.departureTime instanceof Date
        ? payload.departureTime.toISOString()
        : payload.departureTime,
  });
  await insertOutboxEvent(event, topic, payload.routeId);
}

export async function emitRouteDeleted(payload: RouteDeletedPayload) {
  const topic = "route.deleted";
  const event = createRouteDeletedEvent({
    eventId: randomUUID(),
    source: "route-service",
    routeId: payload.routeId,
    driverId: payload.driverId,
  });
  await insertOutboxEvent(event, topic, payload.routeId);
}

export async function emitBookingConfirmed(payload: BookingConfirmedPayload) {
  const topic = "booking.confirmed";
  const event = createBookingConfirmedEvent({
    eventId: randomUUID(),
    source: "route-service",
    ...payload,
  });
  await insertOutboxEvent(event, topic, payload.bookingId);
}

export async function emitBookingCancelled(payload: BookingCancelledPayload) {
  const topic = "booking.cancelled";
  const event = createBookingCancelledEvent({
    eventId: randomUUID(),
    source: "route-service",
    ...payload,
  });
  await insertOutboxEvent(event, topic, payload.bookingId);
}

export async function emitTripCompleted(payload: TripCompletedPayload) {
  const topic = "trip.completed";
  const event = createTripCompletedEvent({
    eventId: randomUUID(),
    source: "route-service",
    ...payload,
  });
  await insertOutboxEvent(event, topic, payload.tripId);
}

export async function emitTripCancelled(payload: TripStatusPayload) {
  const topic = "trip.cancelled";
  const event = createTripCancelledEvent({
    eventId: randomUUID(),
    source: "route-service",
    ...payload,
  });
  await insertOutboxEvent(event, topic, payload.tripId);
}

export async function sendBookingNotification(
  payload: EmailNotificationPayload,
) {
  const topic = "notification.email.send";
  const event = createNotificationEmailEvent({
    eventId: randomUUID(),
    source: "route-service",
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    template: payload.template,
    propsJson: payload.propsJson,
  });
  await insertOutboxEvent(event, topic, payload.to);
}

interface BookingCreatedPayload {
  bookingId: string;
  tripId: string;
  userId: string;
  fareAmount: number;
  currency: string;
  expiresAt: string;
}

export async function emitBookingCreated(payload: BookingCreatedPayload) {
  const topic = "booking.created";
  const event = createBookingCreatedEvent({
    eventId: randomUUID(),
    source: "route-service",
    bookingId: payload.bookingId,
    tripId: payload.tripId,
    userId: payload.userId,
    fareAmount: payload.fareAmount,
    currency: payload.currency,
    expiresAt: payload.expiresAt,
  });
  await insertOutboxEvent(event, topic, payload.bookingId);
}

async function insertOutboxEvent(
  event: OutboxEvent | Record<string, unknown>,
  topic: string,
  aggregateId: string,
): Promise<void> {
  const eventId = (event as { eventId?: string }).eventId || randomUUID();

  await db.insert(outboxEvents).values({
    eventId: eventId,
    aggregateType: topic,
    aggregateId: aggregateId,
    eventType: (event as { eventType?: string }).eventType || topic,
    eventVersion: (event as { eventVersion?: number }).eventVersion || 1,
    payload: event as any,
    traceId: (event as { traceId?: string }).traceId,
    spanId: (event as { spanId?: string }).spanId,
  });

  logger.info("kafka.outbox_event_created", {
    eventId,
    topic,
    aggregateId,
  });
}
