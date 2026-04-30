import {
  createConsumer,
  decodeEvent,
  isSchemaRegistryEncoded,
  isEventProcessed,
  checkIdempotency,
  type KafkaConsumer,
  type BookingCreatedEvent,
} from "@shared/kafka";
import { logger, reportError } from "@shared/logger";
import { handleBookingCreated } from "../bookingCreatedConsumer";

const kafkaLogger = logger.child({ component: "kafka-consumer" });

export async function startPaymentConsumer(): Promise<KafkaConsumer> {
  const consumer = await createConsumer("payment-service");

  await consumer.subscribe({
    topic: "booking.created",
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message, partition }) => {
      try {
        const value = message.value;
        if (!value) {
          kafkaLogger.warn("kafka.empty_message", { topic });
          return;
        }

        if (!isSchemaRegistryEncoded(value)) {
          kafkaLogger.warn("kafka.invalid_encoding_message_skipped", {
            topic,
            partition,
            offset: message.offset,
            key: message.key?.toString() || null,
            firstByte: value[0],
          });
          return;
        }

        const event = await decodeEvent<BookingCreatedEvent>(value);
        const eventId = event.eventId;

        const alreadyProcessed = await isEventProcessed(
          eventId,
          "payment-service",
        );
        if (alreadyProcessed) {
          kafkaLogger.info("kafka.event_already_processed_skipping", {
            eventId,
            topic,
          });
          return;
        }

        kafkaLogger.info("kafka.processing_booking_created", {
          eventId,
          topic,
          bookingId: event.payload.bookingId,
        });

        await handleBookingCreated(event.payload);
        await checkIdempotency(eventId, "payment-service");
      } catch (error) {
        reportError(error, {
          source: "kafka",
          topic,
          message: "Failed to process payment-service booking event",
        });
        throw error;
      }
    },
  });

  kafkaLogger.info("kafka.consumer_started", {
    topics: ["booking.created"],
  });

  return consumer;
}
