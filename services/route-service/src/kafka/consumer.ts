import {
  createConsumer,
  decodeEvent,
  TOPICS,
  type KafkaConsumer,
  type PaymentCompletedEvent,
  type PaymentFailedEvent,
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

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const value = message.value;

        if (!value) {
          console.warn("Received empty message");
          return;
        }

        if (topic === TOPICS.PAYMENT_COMPLETED) {
          const event = await decodeEvent<PaymentCompletedEvent>(value);
          await routeService.syncBookingPaymentStatus({
            bookingId: event.payload.bookingId,
            paymentReference: event.payload.paymentReference,
            paymentStatus: event.payload.paymentStatus,
          });
          return;
        }

        if (topic === TOPICS.PAYMENT_FAILED) {
          const event = await decodeEvent<PaymentFailedEvent>(value);
          await routeService.syncBookingPaymentStatus({
            bookingId: event.payload.bookingId,
            paymentReference: event.payload.paymentReference,
            paymentStatus: event.payload.paymentStatus,
          });
        }
      } catch (error) {
        console.error("Failed to process payment event:", error);
      }
    },
  });

  console.log("Route service Kafka consumer started");
  return consumer;
}
