import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/db";
import { outboxEvents } from "../../db/schema";
import {
  createNotificationEmailEvent,
  createUserIdentityUpsertedEvent,
  createUserAccountDeletedEvent,
  EVENT_SCHEMAS,
  type EventByType,
  type SupportedEventType,
} from "@shared/kafka/events";
import { disconnectProducer, encodeEvent, getProducer } from "@shared/kafka";
const OUTBOX_POLL_INTERVAL_MS = parseInt(
  process.env.OUTBOX_POLL_INTERVAL_MS || "3000",
  10,
);
const OUTBOX_BATCH_SIZE = parseInt(process.env.OUTBOX_BATCH_SIZE || "25", 10);

interface NotificationEmailInput {
  to: string;
  subject: string;
  html?: string;
  template?: string;
  propsJson?: string;
  source: string;
}

type OutboxExecutor = {
  insert: typeof db.insert;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown outbox publishing error";
}

function isSupportedEventType(value: string): value is SupportedEventType {
  return value in EVENT_SCHEMAS;
}

async function insertOutboxEvent<TEventType extends SupportedEventType>(
  executor: OutboxExecutor,
  event: {
    eventType: TEventType;
    payload: EventByType[TEventType];
    partitionKey: string;
  },
): Promise<void> {
  await executor.insert(outboxEvents).values({
    eventType: event.eventType,
    topic: event.eventType,
    partitionKey: event.partitionKey,
    payload: event.payload,
  });
}

export async function enqueueNotificationEmail(
  executor: OutboxExecutor,
  input: NotificationEmailInput,
): Promise<void> {
  const event = createNotificationEmailEvent({
    eventId: randomUUID(),
    source: input.source,
    to: input.to,
    subject: input.subject,
    html: input.html,
    template: input.template,
    propsJson: input.propsJson,
  });

  await insertOutboxEvent(executor, {
    eventType: event.eventType,
    partitionKey: event.payload.to,
    payload: event,
  });
}

export async function enqueueUserAccountDeleted(
  executor: OutboxExecutor,
  input: {
    userId: string;
    source: string;
  },
): Promise<void> {
  const event = createUserAccountDeletedEvent({
    eventId: randomUUID(),
    source: input.source,
    userId: input.userId,
  });

  await insertOutboxEvent(executor, {
    eventType: event.eventType,
    partitionKey: event.payload.userId,
    payload: event,
  });
}

export async function enqueueUserIdentityUpserted(
  executor: OutboxExecutor,
  input: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    source: string;
  },
): Promise<void> {
  const event = createUserIdentityUpsertedEvent({
    eventId: randomUUID(),
    source: input.source,
    userId: input.userId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
  });

  await insertOutboxEvent(executor, {
    eventType: event.eventType,
    partitionKey: event.payload.userId,
    payload: event,
  });
}

export async function publishPendingOutboxEvents(): Promise<void> {
  const producer = await getProducer();
  const pendingEvents = await db
    .select()
    .from(outboxEvents)
    .where(eq(outboxEvents.status, "pending"))
    .orderBy(asc(outboxEvents.createdAt))
    .limit(OUTBOX_BATCH_SIZE);

  for (const event of pendingEvents) {
    if (!isSupportedEventType(event.eventType)) {
      await db
        .update(outboxEvents)
        .set({
          status: "failed",
          attempts: event.attempts + 1,
          lastError: `Unsupported event type: ${event.eventType}`,
          updatedAt: new Date(),
        })
        .where(eq(outboxEvents.id, event.id));
      continue;
    }

    await db
      .update(outboxEvents)
      .set({
        status: "processing",
        attempts: event.attempts + 1,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(outboxEvents.id, event.id));

    try {
      const payload = event.payload as EventByType[typeof event.eventType];
      const encoded = await encodeEvent(event.eventType, payload);

      await producer.send({
        topic: event.topic,
        messages: [
          {
            key: event.partitionKey,
            value: encoded,
          },
        ],
      });

      await db
        .update(outboxEvents)
        .set({
          status: "published",
          publishedAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(outboxEvents.id, event.id));
    } catch (error) {
      await db
        .update(outboxEvents)
        .set({
          status: "pending",
          lastError: getErrorMessage(error),
          updatedAt: new Date(),
        })
        .where(eq(outboxEvents.id, event.id));
    }
  }
}

export async function startOutboxPublisher(): Promise<{
  stop: () => Promise<void>;
}> {
  await getProducer();
  await publishPendingOutboxEvents();

  const timer = setInterval(() => {
    void publishPendingOutboxEvents();
  }, OUTBOX_POLL_INTERVAL_MS);

  return {
    stop: async () => {
      clearInterval(timer);
      await disconnectProducer();
    },
  };
}
