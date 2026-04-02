import {
  createConsumer,
  decodeEvent,
  TOPICS,
  type KafkaConsumer,
  type NotificationEmailRequestedEvent,
} from "@shared/kafka";
import { MailService } from "../mailService";

const mailService = new MailService();

export async function startEmailConsumer(): Promise<KafkaConsumer> {
  const consumer = await createConsumer("mail-service");

  await consumer.subscribe({
    topic: TOPICS.NOTIFICATION_EMAIL_SEND,
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

        const event =
          await decodeEvent<NotificationEmailRequestedEvent>(value);
        console.log(`Processing email to: ${event.payload.to}`);

        await mailService.sendMail(
          event.payload.to,
          event.payload.subject,
          event.payload.html,
        );
        console.log(`Email sent successfully to: ${event.payload.to}`);
      } catch (error) {
        console.error("Failed to process email message:", error);
      }
    },
  });

  console.log("Mail service Kafka consumer started");
  return consumer;
}
