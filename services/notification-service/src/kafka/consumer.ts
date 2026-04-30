import {
  createConsumer,
  decodeEvent,
  getProducer,
  isSchemaRegistryEncoded,
  TOPICS,
  type KafkaConsumer,
} from "@shared/kafka";
import { logger, reportError } from "@shared/logger";
import { sentryServer } from "@shared/sentry";
import { enqueueNotificationEventJob } from "../boss";

const kafkaLogger = logger.child({ component: "kafka-consumer" });
const DLQ_TOPIC = "notification-service.dlq";

async function sendToDlq(
  topic: string,
  eventId: string,
  event: unknown,
  error: Error,
): Promise<void> {
  kafkaLogger.error("kafka.event_dlq", {
    eventId,
    topic,
    error: error.message,
    dlqTopic: DLQ_TOPIC,
  });

  try {
    const producer = await getProducer();
    await producer.send({
      topic: DLQ_TOPIC,
      messages: [
        {
          key: eventId,
          value: JSON.stringify({
            originalTopic: topic,
            originalEventId: eventId,
            event,
            error: error.message,
            failedAt: new Date().toISOString(),
          }),
        },
      ],
    });
  } catch (produceError) {
    reportError(produceError as Error, {
      source: "kafka",
      topic,
      message: "Failed to produce to DLQ",
    });
    sentryServer.captureException(produceError, "system", {
      action: "notificationConsumer_sendToDlq",
      topic,
      eventId,
    });
  }
}

export async function startNotificationConsumer(): Promise<KafkaConsumer> {
  const consumer = await createConsumer("notification-service");

  await consumer.subscribe({
    topic: TOPICS.BOOKING_CONFIRMED,
    fromBeginning: false,
  });
  await consumer.subscribe({
    topic: TOPICS.TRIP_COMPLETED,
    fromBeginning: false,
  });
  await consumer.subscribe({
    topic: TOPICS.TRIP_CANCELLED,
    fromBeginning: false,
  });
  await consumer.subscribe({
    topic: TOPICS.PAYOUT_COMPLETED,
    fromBeginning: false,
  });
  await consumer.subscribe({
    topic: TOPICS.PAYOUT_FAILED,
    fromBeginning: false,
  });
  await consumer.subscribe({
    topic: TOPICS.DRIVER_BANK_VERIFICATION_REQUESTED,
    fromBeginning: false,
  });
  await consumer.subscribe({
    topic: TOPICS.DRIVER_IDENTITY_CREATED,
    fromBeginning: true,
  });
  await consumer.subscribe({
    topic: TOPICS.DRIVER_IDENTITY_UPDATED,
    fromBeginning: true,
  });
  await consumer.subscribe({
    topic: TOPICS.DRIVER_IDENTITY_DELETED,
    fromBeginning: true,
  });
  await consumer.subscribe({
    topic: TOPICS.DRIVER_BANK_VERIFIED,
    fromBeginning: false,
  });
  await consumer.subscribe({
    topic: TOPICS.DRIVER_BANK_VERIFICATION_FAILED,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message, partition }) => {
      if (!message.value) {
        return;
      }

      if (!isSchemaRegistryEncoded(message.value)) {
        const encodingError = new Error(
          `Invalid Kafka payload encoding for topic ${topic}. Expected Confluent Schema Registry wire format.`,
        );
        sentryServer.captureException(encodingError, "system", {
          action: "notificationConsumer_invalidEncoding",
          topic,
          partition,
          offset: message.offset,
          key: message.key?.toString() || null,
          firstByte: message.value[0],
        });
        await sendToDlq(
          topic,
          message.key?.toString() || "unknown-event-id",
          message.value.toString("base64"),
          encodingError,
        );
        return;
      }

      let event: { eventId?: string };
      try {
        event = await decodeEvent<{ eventId?: string }>(message.value);
      } catch (error) {
        const decodeError =
          error instanceof Error ? error : new Error(String(error));
        sentryServer.captureException(decodeError, "system", {
          action: "notificationConsumer_decodeEvent",
          topic,
          key: message.key?.toString() || null,
        });
        await sendToDlq(
          topic,
          message.key?.toString() || "unknown-event-id",
          message.value.toString("base64"),
          decodeError,
        );
        return;
      }

      const eventId = event.eventId;
      if (!eventId) {
        sentryServer.captureException(
          new Error("Decoded event is missing eventId"),
          "system",
          {
            action: "notificationConsumer_missingEventId",
            topic,
            key: message.key?.toString() || null,
          },
        );
        await sendToDlq(
          topic,
          message.key?.toString() || "missing-event-id",
          message.value.toString("base64"),
          new Error("Decoded event is missing eventId"),
        );
        return;
      }

      await enqueueNotificationEventJob({
        topic,
        rawMessage: message.value.toString("base64"),
        eventId,
      });
    },
  });

  kafkaLogger.info("kafka.consumer_started", {
    topics: [
      TOPICS.BOOKING_CONFIRMED,
      TOPICS.TRIP_COMPLETED,
      TOPICS.TRIP_CANCELLED,
      TOPICS.PAYOUT_COMPLETED,
      TOPICS.PAYOUT_FAILED,
      TOPICS.DRIVER_BANK_VERIFICATION_REQUESTED,
      TOPICS.DRIVER_IDENTITY_CREATED,
      TOPICS.DRIVER_IDENTITY_UPDATED,
      TOPICS.DRIVER_IDENTITY_DELETED,
      TOPICS.DRIVER_BANK_VERIFIED,
      TOPICS.DRIVER_BANK_VERIFICATION_FAILED,
    ],
  });

  return consumer;
}
