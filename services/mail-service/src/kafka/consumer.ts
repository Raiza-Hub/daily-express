import {
  createConsumer,
  decodeEvent,
  isSchemaRegistryEncoded,
  isEventProcessed,
  checkIdempotency,
  type KafkaConsumer,
  type NotificationEmailRequestedEvent,
  type PayoutFailedEvent,
  NOTIFICATION_EMAIL_EVENT_TYPE,
  PAYOUT_FAILED_EVENT_TYPE,
} from "@shared/kafka";
import { logger, reportError } from "@shared/logger";
import { MailService } from "../mailService";

const mailService = new MailService();
const kafkaLogger = logger.child({ component: "kafka-consumer" });

async function handleNotificationEmail(
  event: NotificationEmailRequestedEvent,
): Promise<void> {
  let html = event.payload.html;
  let subject = event.payload.subject;

  try {
    if (event.payload.template) {
      const { renderEmail, getEmailSubject, isSupportedTemplate } =
        await import("@repo/email");

      if (!isSupportedTemplate(event.payload.template)) {
        throw new Error(`Template ${event.payload.template} is not supported.`);
      }

      const propsJson = event.payload.propsJson || "{}";
      html = await renderEmail(event.payload.template, propsJson);

      if (!subject) {
        subject = getEmailSubject(event.payload.template, propsJson);
      }
    }
  } catch (renderError) {
    kafkaLogger.error("email.render_failed", {
      error: renderError,
      template: event.payload.template,
    });
    throw renderError;
  }

  if (!html) {
    throw new Error("No HTML or template provided for email notification");
  }

  await mailService.sendMail(event.payload.to, subject, html);
  kafkaLogger.info("email.delivered");
}

async function handlePayoutFailed(event: PayoutFailedEvent): Promise<void> {
  const { renderEmail, getEmailSubject } = await import("@repo/email");

  const propsJson = JSON.stringify({
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
    driverName: event.payload.driverName,
    driverEmail: event.payload.driverEmail,
    amountMinor: event.payload.amountMinor,
    koraFeeAmount: event.payload.koraFeeAmount,
    reference: event.payload.reference,
    failureReason: event.payload.failureReason,
    bankName: event.payload.bankName,
    accountLast4: event.payload.accountLast4,
  });

  const html = await renderEmail("PayoutFailedEmail", propsJson);
  const subject = getEmailSubject("PayoutFailedEmail", propsJson);

  await mailService.sendMail(event.payload.driverEmail, subject, html);
  kafkaLogger.info("payout_failed_email.delivered");
}

export async function startEmailConsumer(): Promise<KafkaConsumer> {
  const consumer = await createConsumer("mail-service");

  await consumer.subscribe({
    topic: "notification.email.send",
    fromBeginning: false,
  });

  await consumer.subscribe({
    topic: "payout.failed",
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message, partition }) => {
      try {
        const value = message.value;
        if (!value) {
          kafkaLogger.warn("kafka.empty_message", {
            topic,
          });
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

        const event = await decodeEvent<{ eventId: string }>(value);
        const eventId = event.eventId;

        const alreadyProcessed = await isEventProcessed(
          eventId,
          "mail-service",
        );
        if (alreadyProcessed) {
          kafkaLogger.info("kafka.event_already_processed_skipping", {
            eventId,
            topic,
          });
          return;
        }

        const decodedEvent = (await decodeEvent<
          NotificationEmailRequestedEvent | PayoutFailedEvent
        >(value)) as NotificationEmailRequestedEvent | PayoutFailedEvent;

        kafkaLogger.info("email.delivery_requested", {
          eventType: decodedEvent.eventType,
        });

        const eventType = decodedEvent.eventType as string;
        if (eventType === "payout.failed") {
          await handlePayoutFailed(decodedEvent as PayoutFailedEvent);
        } else if (eventType === "notification.email.send") {
          await handleNotificationEmail(
            decodedEvent as NotificationEmailRequestedEvent,
          );
        } else {
          kafkaLogger.warn("kafka.unknown_event_type", {
            eventType,
          });
        }

        await checkIdempotency(eventId, "mail-service");
      } catch (error) {
        reportError(error, {
          source: "kafka",
          topic,
          message: "Failed to process email message",
        });
        throw error;
      }
    },
  });

  kafkaLogger.info("kafka.consumer_started", {
    topics: ["notification.email.send", "payout.failed"],
  });
  return consumer;
}
