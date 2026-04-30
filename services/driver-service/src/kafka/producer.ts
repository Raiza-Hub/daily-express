import { randomUUID } from "node:crypto";
import {
  TOPICS,
  createDriverBankVerificationRequestedEvent,
  createDriverIdentityCreatedEvent,
  createDriverIdentityDeletedEvent,
  createDriverIdentityUpdatedEvent,
  createDriverPayoutProfileDeletedEvent,
  createDriverPayoutProfileUpsertedEvent,
  getProducer,
} from "@shared/kafka";
import { logger } from "@shared/logger";
import { db } from "../../db/db";
import { driver, outboxEvents } from "../../db/schema";

export { getProducer } from "@shared/kafka";

type DriverRecord = typeof driver.$inferSelect;
type OutboxWriter = {
  insert: typeof db.insert;
};

interface DriverIdentityDeletedPayload {
  driverId: string;
  userId: string;
}

interface DriverBankVerificationRequestedPayload {
  driverId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  currency: string;
}

function mapDriverIdentityPayload(record: DriverRecord) {
  return {
    driverId: record.id,
    userId: record.userId,
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    phone: record.phone,
    country: record.country,
    state: record.state,
    city: record.city,
    currency: record.currency,
    isActive: record.isActive,
    profilePictureUrl: record.profile_pic ?? null,
  };
}

async function insertOutboxEvent(
  writer: OutboxWriter,
  event: Record<string, any>,
  topic: string,
  aggregateId: string,
) {
  await writer.insert(outboxEvents).values({
    eventId: event.eventId,
    aggregateType: topic,
    aggregateId,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    payload: event,
    traceId: event.traceId,
    spanId: event.spanId,
  });

  logger.info("kafka.outbox_event_created", {
    eventId: event.eventId,
    topic,
    aggregateId,
  });
}

export async function emitDriverIdentityCreated(
  record: DriverRecord,
  writer: OutboxWriter = db,
) {
  const event = createDriverIdentityCreatedEvent({
    eventId: randomUUID(),
    source: "driver-service",
    ...mapDriverIdentityPayload(record),
  });

  await insertOutboxEvent(writer, event, TOPICS.DRIVER_IDENTITY_CREATED, record.id);
}

export async function emitDriverIdentityUpdated(
  record: DriverRecord,
  writer: OutboxWriter = db,
) {
  const event = createDriverIdentityUpdatedEvent({
    eventId: randomUUID(),
    source: "driver-service",
    ...mapDriverIdentityPayload(record),
  });

  await insertOutboxEvent(writer, event, TOPICS.DRIVER_IDENTITY_UPDATED, record.id);
}

export async function emitDriverIdentityDeleted(
  payload: DriverIdentityDeletedPayload,
  writer: OutboxWriter = db,
) {
  const event = createDriverIdentityDeletedEvent({
    eventId: randomUUID(),
    source: "driver-service",
    driverId: payload.driverId,
    userId: payload.userId,
  });

  await insertOutboxEvent(
    writer,
    event,
    TOPICS.DRIVER_IDENTITY_DELETED,
    payload.driverId,
  );
}

export async function emitDriverPayoutProfileUpserted(
  record: DriverRecord,
  writer: OutboxWriter = db,
) {
  const event = createDriverPayoutProfileUpsertedEvent({
    eventId: randomUUID(),
    source: "driver-service",
    driverId: record.id,
    userId: record.userId,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    phone: record.phone,
    currency: record.currency,
    isActive: record.isActive,
    bankName: record.bankName,
    bankCode: record.bankCode,
    accountNumber: record.accountNumber,
    accountName: record.accountName,
    bankVerificationStatus: record.bankVerificationStatus,
    bankVerificationFailureReason: record.bankVerificationFailureReason,
    updatedAt: record.updatedAt.toISOString(),
  });

  await insertOutboxEvent(
    writer,
    event,
    TOPICS.DRIVER_PAYOUT_PROFILE_UPSERTED,
    record.id,
  );
}

export async function emitDriverPayoutProfileDeleted(
  payload: DriverIdentityDeletedPayload,
  writer: OutboxWriter = db,
) {
  const event = createDriverPayoutProfileDeletedEvent({
    eventId: randomUUID(),
    source: "driver-service",
    driverId: payload.driverId,
    userId: payload.userId,
    deletedAt: new Date().toISOString(),
  });

  await insertOutboxEvent(
    writer,
    event,
    TOPICS.DRIVER_PAYOUT_PROFILE_DELETED,
    payload.driverId,
  );
}

export async function emitDriverBankVerificationRequested(
  payload: DriverBankVerificationRequestedPayload,
  writer: OutboxWriter = db,
) {
  const event = createDriverBankVerificationRequestedEvent({
    eventId: randomUUID(),
    source: "driver-service",
    driverId: payload.driverId,
    bankName: payload.bankName,
    bankCode: payload.bankCode,
    accountNumber: payload.accountNumber,
    accountName: payload.accountName,
    currency: payload.currency,
  });

  await insertOutboxEvent(
    writer,
    event,
    TOPICS.DRIVER_BANK_VERIFICATION_REQUESTED,
    payload.driverId,
  );
}
