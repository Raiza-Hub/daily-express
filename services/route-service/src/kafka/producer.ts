import { getProducer, TOPICS } from "@shared/kafka";

export { getProducer } from "@shared/kafka";

interface RouteCreatedPayload {
  routeId: string;
  driverId: string;
  origin: string;
  destination: string;
  departureTime: string | Date;
}

interface BookingConfirmedPayload {
  bookingId: string;
  routeId: string;
  userId: string;
  passengerName: string;
  passengerEmail: string;
  seatNumber: number;
}

interface EmailNotificationPayload {
  to: string;
  subject: string;
  html: string;
}

export async function emitRouteCreated(payload: RouteCreatedPayload) {
  const producer = await getProducer();
  await producer.send({
    topic: TOPICS.ROUTE_CREATED,
    messages: [
      {
        key: payload.routeId,
        value: JSON.stringify(payload),
      },
    ],
  });
}

export async function emitBookingConfirmed(payload: BookingConfirmedPayload) {
  const producer = await getProducer();
  await producer.send({
    topic: TOPICS.BOOKING_CONFIRMED,
    messages: [
      {
        key: payload.bookingId,
        value: JSON.stringify(payload),
      },
    ],
  });
}

export async function sendBookingNotification(
  payload: EmailNotificationPayload,
) {
  const producer = await getProducer();
  await producer.send({
    topic: TOPICS.NOTIFICATION_EMAIL_SEND,
    messages: [
      {
        key: payload.to,
        value: JSON.stringify({
          type: "booking_notification",
          ...payload,
        }),
      },
    ],
  });
}
