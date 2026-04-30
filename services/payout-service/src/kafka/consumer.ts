import {
  createConsumer,
  decodeEvent,
  isSchemaRegistryEncoded,
  BOOKING_CANCELLED_EVENT_TYPE,
  BOOKING_CONFIRMED_EVENT_TYPE,
  DRIVER_BANK_VERIFICATION_REQUESTED_EVENT_TYPE,
  DRIVER_PAYOUT_PROFILE_DELETED_EVENT_TYPE,
  DRIVER_PAYOUT_PROFILE_UPSERTED_EVENT_TYPE,
  TRIP_CANCELLED_EVENT_TYPE,
  TRIP_COMPLETED_EVENT_TYPE,
  TOPICS,
  isEventProcessed,
  checkIdempotency,
  type BookingCancelledEvent,
  type BookingConfirmedEvent,
  type DriverBankVerificationRequestedEvent,
  type DriverPayoutProfileDeletedEvent,
  type DriverPayoutProfileUpsertedEvent,
  type KafkaConsumer,
  type TripCancelledEvent,
  type TripCompletedEvent,
} from "@shared/kafka";
import { logger, reportError } from "@shared/logger";
import { sentryServer } from "@shared/sentry";
import { PayoutService } from "../payoutService";

const payoutService = new PayoutService();
const kafkaLogger = logger.child({ component: "kafka-consumer" });

export async function startPayoutConsumer(): Promise<KafkaConsumer> {
  const consumer = await createConsumer("payout-service");

  await consumer.subscribe({
    topic: TOPICS.BOOKING_CONFIRMED,
    fromBeginning: false,
  });
  await consumer.subscribe({
    topic: TOPICS.BOOKING_CANCELLED,
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
    topic: TOPICS.DRIVER_BANK_VERIFICATION_REQUESTED,
    fromBeginning: false,
  });
  await consumer.subscribe({
    topic: TOPICS.DRIVER_PAYOUT_PROFILE_UPSERTED,
    fromBeginning: true,
  });
  await consumer.subscribe({
    topic: TOPICS.DRIVER_PAYOUT_PROFILE_DELETED,
    fromBeginning: true,
  });

  await consumer.run({
    eachMessage: async ({ topic, message, partition }) => {
      try {
        if (!message.value) {
          return;
        }

        if (!isSchemaRegistryEncoded(message.value)) {
          kafkaLogger.warn("kafka.invalid_encoding_message_skipped", {
            topic,
            partition,
            offset: message.offset,
            key: message.key?.toString() || null,
            firstByte: message.value[0],
          });
          return;
        }

        const event = await decodeEvent<{ eventId: string }>(message.value);
        const eventId = event.eventId;

        const alreadyProcessed = await isEventProcessed(
          eventId,
          "payout-service",
        );
        if (alreadyProcessed) {
          kafkaLogger.info("kafka.event_already_processed_skipping", {
            eventId,
            topic,
          });
          return;
        }

        if (topic === TOPICS.BOOKING_CONFIRMED) {
          const decodedEvent = await decodeEvent<BookingConfirmedEvent>(
            message.value,
          );
          if (decodedEvent.eventType === BOOKING_CONFIRMED_EVENT_TYPE) {
            await payoutService.handleBookingConfirmed(decodedEvent, topic);
          }
          await checkIdempotency(eventId, "payout-service");
          return;
        }

        if (topic === TOPICS.BOOKING_CANCELLED) {
          const decodedEvent = await decodeEvent<BookingCancelledEvent>(
            message.value,
          );
          if (decodedEvent.eventType === BOOKING_CANCELLED_EVENT_TYPE) {
            await payoutService.handleBookingCancelled(decodedEvent, topic);
          }
          await checkIdempotency(eventId, "payout-service");
          return;
        }

        if (topic === TOPICS.TRIP_COMPLETED) {
          const decodedEvent = await decodeEvent<TripCompletedEvent>(
            message.value,
          );
          if (decodedEvent.eventType === TRIP_COMPLETED_EVENT_TYPE) {
            await payoutService.handleTripCompleted(decodedEvent, topic);
          }
          await checkIdempotency(eventId, "payout-service");
          return;
        }

        if (topic === TOPICS.TRIP_CANCELLED) {
          const decodedEvent = await decodeEvent<TripCancelledEvent>(
            message.value,
          );
          if (decodedEvent.eventType === TRIP_CANCELLED_EVENT_TYPE) {
            await payoutService.handleTripCancelled(decodedEvent, topic);
          }
          await checkIdempotency(eventId, "payout-service");
          return;
        }

        if (topic === TOPICS.DRIVER_BANK_VERIFICATION_REQUESTED) {
          const decodedEvent =
            await decodeEvent<DriverBankVerificationRequestedEvent>(
              message.value,
            );
          if (
            decodedEvent.eventType ===
            DRIVER_BANK_VERIFICATION_REQUESTED_EVENT_TYPE
          ) {
            await payoutService.handleDriverBankVerificationRequested(
              decodedEvent,
              topic,
            );
          }
          await checkIdempotency(eventId, "payout-service");
          return;
        }

        if (topic === TOPICS.DRIVER_PAYOUT_PROFILE_UPSERTED) {
          const decodedEvent =
            await decodeEvent<DriverPayoutProfileUpsertedEvent>(message.value);
          if (
            decodedEvent.eventType === DRIVER_PAYOUT_PROFILE_UPSERTED_EVENT_TYPE
          ) {
            await payoutService.handleDriverPayoutProfileUpserted(
              decodedEvent,
              topic,
            );
          }
          await checkIdempotency(eventId, "payout-service");
          return;
        }

        if (topic === TOPICS.DRIVER_PAYOUT_PROFILE_DELETED) {
          const decodedEvent =
            await decodeEvent<DriverPayoutProfileDeletedEvent>(message.value);
          if (
            decodedEvent.eventType === DRIVER_PAYOUT_PROFILE_DELETED_EVENT_TYPE
          ) {
            await payoutService.handleDriverPayoutProfileDeleted(
              decodedEvent,
              topic,
            );
          }
          await checkIdempotency(eventId, "payout-service");
          return;
        }
      } catch (error) {
        sentryServer.captureException(error, "unknown", {
          action: "kafkaConsumer_eachMessage",
          values: { topic, messageKey: message.key?.toString() },
        });
        reportError(error, {
          source: "kafka",
          topic,
          message: "Failed to process payout event",
        });
        throw error;
      }
    },
  });

  kafkaLogger.info("kafka.consumer_started", {
    topics: [
      TOPICS.BOOKING_CONFIRMED,
      TOPICS.BOOKING_CANCELLED,
      TOPICS.TRIP_COMPLETED,
      TOPICS.TRIP_CANCELLED,
      TOPICS.DRIVER_BANK_VERIFICATION_REQUESTED,
      TOPICS.DRIVER_PAYOUT_PROFILE_UPSERTED,
      TOPICS.DRIVER_PAYOUT_PROFILE_DELETED,
    ],
  });

  return consumer;
}
