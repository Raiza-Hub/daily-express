import {
  createConsumer,
  decodeEvent,
  isSchemaRegistryEncoded,
  TOPICS,
  type KafkaConsumer,
  type DriverIdentityCreatedEvent,
  type DriverIdentityDeletedEvent,
  type DriverIdentityUpdatedEvent,
  type PaymentCompletedEvent,
  type PaymentFailedEvent,
  type UserAccountDeletedEvent,
  type UserIdentityUpsertedEvent,
} from "@shared/kafka";
import { RouteService } from "../routeService";

const routeService = new RouteService();

export async function startRouteConsumer(): Promise<KafkaConsumer> {
  const consumer = await createConsumer("route-service");

  await consumer.subscribe({
    topic: TOPICS.PAYMENT_COMPLETED,
    fromBeginning: false,
  });

  await consumer.subscribe({
    topic: TOPICS.PAYMENT_FAILED,
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
    topic: TOPICS.USER_IDENTITY_UPSERTED,
    fromBeginning: true,
  });

  await consumer.subscribe({
    topic: TOPICS.USER_ACCOUNT_DELETED,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message, partition }) => {
      try {
        const value = message.value;

        if (!value) {
          console.warn("Received empty message");
          return;
        }

        if (!isSchemaRegistryEncoded(value)) {
          console.warn("Skipping non-Schema-Registry Kafka message", {
            topic,
            partition,
            offset: message.offset,
            key: message.key?.toString() || null,
            firstByte: value[0],
          });
          return;
        }

        if (topic === TOPICS.PAYMENT_COMPLETED) {
          const event = await decodeEvent<PaymentCompletedEvent>(value);
          if (!event.payload.bookingId) {
            console.warn("Skipping payment.completed event with missing bookingId", {
              topic,
              partition,
              offset: message.offset,
            });
            return;
          }
          await routeService.syncBookingPaymentStatus({
            bookingId: event.payload.bookingId,
            paymentReference: event.payload.paymentReference,
            paymentStatus: event.payload.paymentStatus,
          });
          return;
        }

        if (topic === TOPICS.PAYMENT_FAILED) {
          const event = await decodeEvent<PaymentFailedEvent>(value);
          if (!event.payload.bookingId) {
            console.warn("Skipping payment.failed event with missing bookingId", {
              topic,
              partition,
              offset: message.offset,
            });
            return;
          }
          await routeService.syncBookingPaymentStatus({
            bookingId: event.payload.bookingId,
            paymentReference: event.payload.paymentReference,
            paymentStatus: event.payload.paymentStatus,
          });
          return;
        }

        if (topic === TOPICS.DRIVER_IDENTITY_CREATED) {
          const event = await decodeEvent<DriverIdentityCreatedEvent>(value);
          await routeService.handleDriverIdentityCreated(event, topic);
          return;
        }

        if (topic === TOPICS.DRIVER_IDENTITY_UPDATED) {
          const event = await decodeEvent<DriverIdentityUpdatedEvent>(value);
          await routeService.handleDriverIdentityUpdated(event, topic);
          return;
        }

        if (topic === TOPICS.DRIVER_IDENTITY_DELETED) {
          const event = await decodeEvent<DriverIdentityDeletedEvent>(value);
          await routeService.handleDriverIdentityDeleted(event, topic);
          return;
        }

        if (topic === TOPICS.USER_IDENTITY_UPSERTED) {
          const event = await decodeEvent<UserIdentityUpsertedEvent>(value);
          await routeService.handleUserIdentityUpserted(event, topic);
          return;
        }

        if (topic === TOPICS.USER_ACCOUNT_DELETED) {
          const event = await decodeEvent<UserAccountDeletedEvent>(value);
          await routeService.handleUserAccountDeleted(event, topic);
        }
      } catch (error) {
        console.error("Failed to process route-service Kafka event:", error);
        throw error;
      }
    },
  });

  console.log("Route service Kafka consumer started");
  return consumer;
}
