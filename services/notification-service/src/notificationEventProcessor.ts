import {
  decodeEvent,
  type BookingConfirmedEvent,
  type DriverBankVerificationFailedEvent,
  type DriverIdentityCreatedEvent,
  type DriverIdentityDeletedEvent,
  type DriverIdentityUpdatedEvent,
  type DriverBankVerificationRequestedEvent,
  type DriverBankVerifiedEvent,
  type PayoutCompletedEvent,
  type PayoutFailedEvent,
  type TripCancelledEvent,
  type TripCompletedEvent,
} from "@shared/kafka";
import { logger } from "@shared/logger";
import type { NotificationEventJobData } from "./boss";
import { NotificationService } from "./notificationService";

const notificationService = new NotificationService();
const processorLogger = logger.child({
  component: "notification-event-processor",
});

export async function processNotificationEventJob(
  job: NotificationEventJobData,
) {
  const messageValue = Buffer.from(job.rawMessage, "base64");

  switch (job.topic) {
    case "booking.confirmed": {
      const event = await decodeEvent<BookingConfirmedEvent>(messageValue);
      await notificationService.handleBookingConfirmed(event, job.topic);
      return;
    }

    case "trip.completed": {
      const event = await decodeEvent<TripCompletedEvent>(messageValue);
      await notificationService.handleTripCompleted(event, job.topic);
      return;
    }

    case "trip.cancelled": {
      const event = await decodeEvent<TripCancelledEvent>(messageValue);
      await notificationService.handleTripCancelled(event, job.topic);
      return;
    }

    case "payout.completed": {
      const event = await decodeEvent<PayoutCompletedEvent>(messageValue);
      await notificationService.handlePayoutCompleted(event, job.topic);
      return;
    }

    case "payout.failed": {
      const event = await decodeEvent<PayoutFailedEvent>(messageValue);
      await notificationService.handlePayoutFailed(event, job.topic);
      return;
    }

    case "driver.bank.verification.requested": {
      const event =
        await decodeEvent<DriverBankVerificationRequestedEvent>(messageValue);
      await notificationService.handleBankVerificationRequested(
        event,
        job.topic,
      );
      return;
    }

    case "driver.identity.created": {
      const event = await decodeEvent<DriverIdentityCreatedEvent>(messageValue);
      await notificationService.handleDriverIdentityCreated(event, job.topic);
      return;
    }

    case "driver.identity.updated": {
      const event = await decodeEvent<DriverIdentityUpdatedEvent>(messageValue);
      await notificationService.handleDriverIdentityUpdated(event, job.topic);
      return;
    }

    case "driver.identity.deleted": {
      const event = await decodeEvent<DriverIdentityDeletedEvent>(messageValue);
      await notificationService.handleDriverIdentityDeleted(event, job.topic);
      return;
    }

    case "driver.bank.verified": {
      const event = await decodeEvent<DriverBankVerifiedEvent>(messageValue);
      await notificationService.handleBankVerified(event, job.topic);
      return;
    }

    case "driver.bank.verification.failed": {
      const event =
        await decodeEvent<DriverBankVerificationFailedEvent>(messageValue);
      await notificationService.handleBankVerificationFailed(event, job.topic);
      return;
    }

    default:
      processorLogger.warn("notification_event.unknown_topic_skipping", {
        topic: job.topic,
        eventId: job.eventId,
      });
  }
}
