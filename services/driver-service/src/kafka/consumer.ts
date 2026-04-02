import {
  createConsumer,
  decodeEvent,
  TOPICS,
  type KafkaConsumer,
  type UserAccountDeletedEvent,
} from "@shared/kafka";
import { db } from "../../db/db";
import { driver } from "../../db/schema";
import { eq } from "drizzle-orm";

export async function startDriverConsumer(): Promise<KafkaConsumer> {
  const consumer = await createConsumer("driver-service");

  await consumer.subscribe({
    topic: TOPICS.USER_ACCOUNT_DELETED,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const value = message.value;
        if (!value) {
          console.warn("Received empty message");
          return;
        }

        const event = await decodeEvent<UserAccountDeletedEvent>(value);
        console.log(
          `Processing user account deletion for: ${event.payload.userId}`,
        );

        const existingDriver = await db.query.driver.findFirst({
          where: eq(driver.userId, event.payload.userId),
        });

        if (existingDriver) {
          await db
            .delete(driver)
            .where(eq(driver.userId, event.payload.userId));
          console.log(
            `Driver profile deleted for user: ${event.payload.userId}`,
          );
        } else {
          console.log(
            `No driver profile found for user: ${event.payload.userId}`,
          );
        }
      } catch (error) {
        console.error("Failed to process user account deletion:", error);
      }
    },
  });

  console.log("Driver service Kafka consumer started");
  return consumer;
}
