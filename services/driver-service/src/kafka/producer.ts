import { getProducer, TOPICS } from "@shared/kafka";

export { getProducer } from "@shared/kafka";

interface DriverProfileUpdatedPayload {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export async function emitDriverProfileUpdated(
  payload: DriverProfileUpdatedPayload,
) {
  const producer = await getProducer();
  await producer.send({
    topic: TOPICS.DRIVER_PROFILE_UPDATED,
    messages: [
      {
        key: payload.userId,
        value: JSON.stringify(payload),
      },
    ],
  });
}
