import { SchemaRegistry, SchemaType } from "@kafkajs/confluent-schema-registry";
import { checkServerIdentity, type PeerCertificate } from "node:tls";
import {
  Kafka,
  Partitioners,
  logLevel,
  type Consumer,
  type KafkaConfig as KafkaJsConfig,
  type Producer,
  type SASLMechanism,
  type SASLOptions,
} from "kafkajs";
import {
  EVENT_SCHEMAS,
  type EventByType,
  type SupportedEventType,
} from "./events";
import {
  isEventProcessed,
  checkIdempotency,
  markAsProcessed,
} from "./idempotency";
import {
  createOutboxWorker,
  type OutboxWorkerDependencies,
} from "./outbox-worker";
import { KAFKA_CONFIG } from "./config";

export * from "./events";
export {
  isEventProcessed,
  checkIdempotency,
  markAsProcessed,
  createOutboxWorker,
  type OutboxWorkerDependencies,
  KAFKA_CONFIG,
};

function getKafkaConfig() {
  const saslUsername =
    process.env.KAFKA_SASL_USERNAME || process.env.KAFKA_API_KEY;
  const saslPassword =
    process.env.KAFKA_SASL_PASSWORD || process.env.KAFKA_API_SECRET;
  const schemaRegistryUsername =
    process.env.SCHEMA_REGISTRY_USERNAME || process.env.SCHEMA_REGISTRY_API_KEY;
  const schemaRegistryPassword =
    process.env.SCHEMA_REGISTRY_PASSWORD ||
    process.env.SCHEMA_REGISTRY_API_SECRET;

  return {
    brokers: process.env.KAFKA_BROKERS?.split(",").map((broker) =>
      broker.trim(),
    ) || ["localhost:9092"],
    clientId: process.env.KAFKA_CLIENT_ID || "daily-express",
    schemaRegistryUrl:
      process.env.SCHEMA_REGISTRY_URL || "http://localhost:8081",
    ssl:
      process.env.KAFKA_SSL === "true" || Boolean(saslUsername && saslPassword),
    saslUsername,
    saslPassword,
    saslMechanism: (process.env.KAFKA_SASL_MECHANISM ||
      "plain") as SASLMechanism,
    schemaRegistryUsername,
    schemaRegistryPassword,
  };
}

function getKafkaSslConfig(enabled: boolean): KafkaJsConfig["ssl"] {
  if (!enabled) {
    return false;
  }

  if ((process.versions as { bun?: string }).bun) {
    return {
      checkServerIdentity: (host, cert?: PeerCertificate) =>
        cert ? checkServerIdentity(host, cert) : undefined,
    };
  }

  return true;
}

function createKafkaClient(clientId?: string) {
  const config = getKafkaConfig();
  const resolvedClientId = clientId || config.clientId;
  const sasl =
    config.saslUsername && config.saslPassword
      ? ({
          mechanism: config.saslMechanism,
          username: config.saslUsername,
          password: config.saslPassword,
        } as SASLOptions)
      : undefined;
  const kafkaConfig: KafkaJsConfig = {
    clientId: resolvedClientId,
    brokers: config.brokers,
    logLevel:
      resolvedClientId === "kafka-topic-init"
        ? logLevel.NOTHING
        : logLevel.WARN,
    ssl: getKafkaSslConfig(config.ssl),
  };

  if (sasl) {
    kafkaConfig.sasl = sasl;
  }

  return new Kafka(kafkaConfig);
}

function createRegistry() {
  const config = getKafkaConfig();
  const auth =
    config.schemaRegistryUsername && config.schemaRegistryPassword
      ? {
          username: config.schemaRegistryUsername,
          password: config.schemaRegistryPassword,
        }
      : undefined;

  return new SchemaRegistry({
    host: config.schemaRegistryUrl,
    auth,
  });
}

let producerInstance: Producer | null = null;
let producerConnectPromise: Promise<void> | null = null;
const registeredSchemaIds = new Map<SupportedEventType, number>();
const CONFLUENT_MAGIC_BYTE = 0;
const PRODUCER_CONNECT_RETRIES = parseInt(
  process.env.KAFKA_PRODUCER_CONNECT_RETRIES || "20",
  10,
);
const PRODUCER_CONNECT_RETRY_DELAY_MS = parseInt(
  process.env.KAFKA_PRODUCER_CONNECT_RETRY_DELAY_MS || "3000",
  10,
);
const TOPIC_PARTITIONS = parseInt(
  process.env.KAFKA_TOPIC_PARTITIONS || "1",
  10,
);

function getRegistry() {
  return createRegistry();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function connectProducerWithRetry(producer: Producer): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= PRODUCER_CONNECT_RETRIES; attempt += 1) {
    try {
      await producer.connect();
      if (attempt > 1) {
        console.log(
          `Kafka producer connected after retry ${attempt}/${PRODUCER_CONNECT_RETRIES}`,
        );
      }
      return;
    } catch (error) {
      lastError = error;
      const message =
        error instanceof Error ? error.message : "Unknown Kafka connect error";
      console.warn("Kafka producer connect attempt failed", {
        attempt,
        maxAttempts: PRODUCER_CONNECT_RETRIES,
        retryDelayMs: PRODUCER_CONNECT_RETRY_DELAY_MS,
        message,
      });

      if (attempt < PRODUCER_CONNECT_RETRIES) {
        await sleep(PRODUCER_CONNECT_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Kafka producer failed to connect after retries");
}

export async function getProducer(): Promise<Producer> {
  if (!producerInstance) {
    producerInstance = createKafkaClient().producer({
      createPartitioner: Partitioners.DefaultPartitioner,
      idempotent: true,
      maxInFlightRequests: 1,
    });
  }

  if (!producerConnectPromise) {
    producerConnectPromise = connectProducerWithRetry(producerInstance).catch(
      (error) => {
        producerInstance = null;
        producerConnectPromise = null;
        throw error;
      },
    );
  }

  await producerConnectPromise;
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
  producerConnectPromise = null;
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

export async function registerEventSchemas(): Promise<
  Array<{ eventType: SupportedEventType; subject: string; id: number }>
> {
  const registeredSchemas: Array<{
    eventType: SupportedEventType;
    subject: string;
    id: number;
  }> = [];

  for (const eventType of Object.keys(EVENT_SCHEMAS) as SupportedEventType[]) {
    const id = await getSchemaId(eventType);
    registeredSchemas.push({
      eventType,
      subject: EVENT_SCHEMAS[eventType].subject,
      id,
    });
  }

  return registeredSchemas;
}

export async function encodeEvent<TEventType extends SupportedEventType>(
  eventType: TEventType,
  payload: EventByType[TEventType],
): Promise<Buffer> {
  const schemaId = await getSchemaId(eventType);
  return getRegistry().encode(schemaId, payload);
}

export async function decodeEvent<TEvent>(payload: Buffer): Promise<TEvent> {
  if (!isSchemaRegistryEncoded(payload)) {
    throw new Error(
      `Invalid Kafka payload encoding. Expected Confluent magic byte ${CONFLUENT_MAGIC_BYTE}, received ${payload[0] ?? "empty"}`,
    );
  }
  const decoded = await getRegistry().decode(payload);
  return decoded as TEvent;
}

export function isSchemaRegistryEncoded(payload: Buffer): boolean {
  return payload.length > 0 && payload[0] === CONFLUENT_MAGIC_BYTE;
}

export const TOPICS = {
  NOTIFICATION_EMAIL_SEND: "notification.email.send",
  USER_ACCOUNT_CREATED: "user.account.created",
  USER_ACCOUNT_DELETED: "user.account.deleted",
  DRIVER_IDENTITY_CREATED: "driver.identity.created",
  DRIVER_IDENTITY_UPDATED: "driver.identity.updated",
  DRIVER_IDENTITY_DELETED: "driver.identity.deleted",
  DRIVER_PAYOUT_PROFILE_UPSERTED: "driver.payout_profile.upserted",
  DRIVER_PAYOUT_PROFILE_DELETED: "driver.payout_profile.deleted",
  USER_IDENTITY_UPSERTED: "user.identity.upserted",
  ROUTE_CREATED: "route.created",
  ROUTE_DELETED: "route.deleted",
  BOOKING_CONFIRMED: "booking.confirmed",
  BOOKING_CANCELLED: "booking.cancelled",
  TRIP_COMPLETED: "trip.completed",
  TRIP_CANCELLED: "trip.cancelled",
  PAYMENT_COMPLETED: "payment.completed",
  PAYMENT_FAILED: "payment.failed",
  PAYOUT_COMPLETED: "payout.completed",
  PAYOUT_FAILED: "payout.failed",
  DRIVER_BANK_VERIFICATION_REQUESTED: "driver.bank.verification.requested",
  DRIVER_BANK_VERIFIED: "driver.bank.verified",
  DRIVER_BANK_VERIFICATION_FAILED: "driver.bank.verification.failed",
} as const;

export async function ensureTopics(): Promise<void> {
  const admin = createKafkaClient("kafka-topic-init").admin();

  try {
    await admin.connect();
    const existingTopics = await admin.listTopics();
    const allTopics = Object.values(TOPICS);
    const dlqTopics = allTopics.map(
      (topic) => `${topic}${KAFKA_CONFIG.dlq.suffix}`,
    );
    // Service-local DLQ topics that are not generated by the shared suffix helper.
    const serviceDlqTopics = ["notification-service.dlq"];
    const topicsToEnsure = [...allTopics, ...dlqTopics, ...serviceDlqTopics];
    const missingDlqTopics = topicsToEnsure.filter(
      (topic) => !existingTopics.includes(topic),
    );

    if (missingDlqTopics.length === 0) {
      return;
    }

    await admin.createTopics({
      topics: missingDlqTopics.map((topic) => ({
        topic,
        numPartitions: TOPIC_PARTITIONS,
        replicationFactor: 3,
      })),
      waitForLeaders: true,
    });

    console.log(`Kafka topics created: ${missingDlqTopics.join(", ")}`);
  } finally {
    await admin.disconnect();
  }
}

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];
export type KafkaConsumer = Consumer;
export type KafkaProducer = Producer;
