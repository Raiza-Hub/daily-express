import { SchemaRegistry, SchemaType } from "@kafkajs/confluent-schema-registry";
import { Kafka, logLevel, type Consumer, type Producer } from "kafkajs";
import {
  EVENT_SCHEMAS,
  type EventByType,
  type SupportedEventType,
} from "./events";
export * from "./events";

function getKafkaConfig() {
  return {
    brokers:
      process.env.KAFKA_BROKERS?.split(",").map((broker) => broker.trim()) ||
      ["localhost:9092"],
    clientId: process.env.KAFKA_CLIENT_ID || "daily-express",
    schemaRegistryUrl:
      process.env.SCHEMA_REGISTRY_URL || "http://localhost:8081",
  };
}

function createKafkaClient(clientId?: string) {
  const config = getKafkaConfig();

  return new Kafka({
    clientId: clientId || config.clientId,
    brokers: config.brokers,
    logLevel: logLevel.WARN,
  });
}

function createRegistry() {
  return new SchemaRegistry({
    host: getKafkaConfig().schemaRegistryUrl,
  });
}

let producerInstance: Producer | null = null;
const registeredSchemaIds = new Map<SupportedEventType, number>();

function getRegistry() {
  return createRegistry();
}

export async function getProducer(): Promise<Producer> {
  if (!producerInstance) {
    producerInstance = createKafkaClient().producer({
      idempotent: true,
      maxInFlightRequests: 1,
      retry: {
        retries: 5,
      },
    });
    await producerInstance.connect();
  }

  return producerInstance;
}

export async function createConsumer(groupId: string): Promise<Consumer> {
  const consumer = createKafkaClient(groupId).consumer({ groupId });
  await consumer.connect();
  return consumer;
}

export async function disconnectProducer(): Promise<void> {
  if (!producerInstance) {
    return;
  }

  await producerInstance.disconnect();
  producerInstance = null;
}

async function getSchemaId(eventType: SupportedEventType): Promise<number> {
  const existing = registeredSchemaIds.get(eventType);
  if (existing) {
    return existing;
  }

  const registry = createRegistry();
  const { subject, schema } = EVENT_SCHEMAS[eventType];
  const registered = await registry.register(
    {
      type: SchemaType.AVRO,
      schema: JSON.stringify(schema),
    },
    {
      subject,
    },
  );

  registeredSchemaIds.set(eventType, registered.id);
  return registered.id;
}

export async function encodeEvent<TEventType extends SupportedEventType>(
  eventType: TEventType,
  payload: EventByType[TEventType],
): Promise<Buffer> {
  const schemaId = await getSchemaId(eventType);
  return getRegistry().encode(schemaId, payload);
}

export async function decodeEvent<TEvent>(payload: Buffer): Promise<TEvent> {
  const decoded = await getRegistry().decode(payload);
  return decoded as TEvent;
}

export const TOPICS = {
  NOTIFICATION_EMAIL_SEND: "notification.email.send",
  USER_ACCOUNT_CREATED: "user.account.created",
  USER_ACCOUNT_DELETED: "user.account.deleted",
  DRIVER_PROFILE_UPDATED: "driver.profile.updated",
  ROUTE_CREATED: "route.created",
  BOOKING_CONFIRMED: "booking.confirmed",
  PAYMENT_COMPLETED: "payment.completed",
  PAYMENT_FAILED: "payment.failed",
} as const;

export async function ensureTopics(): Promise<void> {
  const admin = createKafkaClient("kafka-topic-init").admin();

  try {
    await admin.connect();
    const existingTopics = await admin.listTopics();
    const allTopics = Object.values(TOPICS);
    const missingTopics = allTopics.filter((topic) => !existingTopics.includes(topic));

    if (missingTopics.length === 0) {
      return;
    }

    await admin.createTopics({
      topics: missingTopics.map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
      })),
      waitForLeaders: true,
    });

    console.log(`Kafka topics created: ${missingTopics.join(", ")}`);
  } finally {
    await admin.disconnect();
  }
}

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];
export type KafkaConsumer = Consumer;
export type KafkaProducer = Producer;
