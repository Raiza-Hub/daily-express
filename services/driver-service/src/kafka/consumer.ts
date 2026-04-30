import {
  createConsumer,
  decodeEvent,
  isSchemaRegistryEncoded,
  isEventProcessed,
  checkIdempotency,
  type BookingConfirmedEvent,
  type DriverBankVerificationFailedEvent,
  type DriverBankVerifiedEvent,
  type KafkaConsumer,
  type PayoutCompletedEvent,
  type RouteCreatedEvent,
  type RouteDeletedEvent,
  type UserAccountDeletedEvent,
} from "@shared/kafka";
import { logger, reportError } from "@shared/logger";
import { db } from "../../db/db";
import { driver, driverStats } from "../../db/schema";
import { eq } from "drizzle-orm";
import {
  emitDriverPayoutProfileDeleted,
  emitDriverPayoutProfileUpserted,
} from "./producer";

const kafkaLogger = logger.child({ component: "kafka-consumer" });
const CONFLUENT_MAGIC_BYTE = 0;

export async function startDriverConsumer(): Promise<KafkaConsumer> {
  const consumer = await createConsumer("driver-service");

  await consumer.subscribe({
    topic: "user.account.deleted",
    fromBeginning: false,
  });

  await consumer.subscribe({
    topic: "booking.confirmed",
    fromBeginning: false,
  });

  await consumer.subscribe({
    topic: "payout.completed",
    fromBeginning: false,
  });

  await consumer.subscribe({
    topic: "driver.bank.verified",
    fromBeginning: false,
  });

  await consumer.subscribe({
    topic: "driver.bank.verification.failed",
    fromBeginning: false,
  });

  await consumer.subscribe({
    topic: "route.created",
    fromBeginning: false,
  });

  await consumer.subscribe({
    topic: "route.deleted",
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message, topic, partition }) => {
      try {
        const value = message.value;
        if (!value) {
          kafkaLogger.warn("kafka.empty_message", { topic });
          return;
        }

        if (!isSchemaRegistryEncoded(value)) {
          kafkaLogger.warn("kafka.legacy_json_message_skipped", {
            topic,
            partition,
            offset: message.offset,
            key: message.key?.toString() || null,
            firstByte: value[0],
            expectedMagicByte: CONFLUENT_MAGIC_BYTE,
          });
          return;
        }

        // Idempotency check for each event
        const event = await decodeEvent<{ eventId: string }>(value);
        const eventId = event.eventId;
        const alreadyProcessed = await isEventProcessed(
          eventId,
          "driver-service",
        );

        if (alreadyProcessed) {
          kafkaLogger.info("kafka.event_already_processed_skipping", {
            eventId,
            topic,
          });
          return;
        }

        if (topic === "user.account.deleted") {
          await handleUserAccountDeleted(value);
        } else if (topic === "booking.confirmed") {
          await handleBookingConfirmed(value);
        } else if (topic === "payout.completed") {
          await handlePayoutCompleted(value);
        } else if (topic === "driver.bank.verified") {
          await handleDriverBankVerified(value);
        } else if (topic === "driver.bank.verification.failed") {
          await handleDriverBankVerificationFailed(value);
        } else if (topic === "route.created") {
          const routeCreatedEvent = await decodeEvent<RouteCreatedEvent>(value);
          await handleRouteCreated(routeCreatedEvent);
        } else if (topic === "route.deleted") {
          const routeDeletedEvent = await decodeEvent<RouteDeletedEvent>(value);
          await handleRouteDeleted(routeDeletedEvent);
        }

        // Mark as processed
        if (eventId) {
          await checkIdempotency(eventId, "driver-service");
        }
      } catch (error) {
        reportError(error, {
          source: "kafka",
          topic,
          message: "Failed to process driver-service message",
        });
        throw error;
      }
    },
  });

  kafkaLogger.info("kafka.consumer_started", {
    topics: [
      "user.account.deleted",
      "booking.confirmed",
      "payout.completed",
      "driver.bank.verified",
      "driver.bank.verification.failed",
      "route.created",
      "route.deleted",
    ],
  });
  return consumer;
}

export async function handleUserAccountDeleted(value: Buffer) {
  const event = await decodeEvent<UserAccountDeletedEvent>(value);
  kafkaLogger.info("driver.account_deletion_received", {
    user_id: event.payload.userId,
  });

  const existingDriver = await db.query.driver.findFirst({
    where: eq(driver.userId, event.payload.userId),
  });

  if (existingDriver) {
    await db.transaction(async (tx) => {
      await tx
        .delete(driverStats)
        .where(eq(driverStats.driverId, existingDriver.id));
      await tx.delete(driver).where(eq(driver.userId, event.payload.userId));
    });
    await emitDriverPayoutProfileDeleted({
      driverId: existingDriver.id,
      userId: existingDriver.userId,
    });
    kafkaLogger.info("driver.profile_deleted", {
      user_id: event.payload.userId,
    });
  } else {
    kafkaLogger.warn("driver.profile_missing", {
      user_id: event.payload.userId,
    });
  }
}

async function handleBookingConfirmed(value: Buffer) {
  const event = await decodeEvent<BookingConfirmedEvent>(value);
  const { driverId, fareAmountMinor, tripDate, departureTime } = event.payload;

  kafkaLogger.info("driver.booking_confirmed_received", {
    driver_id: driverId,
    fare_amount_minor: fareAmountMinor,
    trip_date: tripDate,
    departure_time: departureTime,
  });

  const stats = await db.query.driverStats.findFirst({
    where: eq(driverStats.driverId, driverId),
  });

  if (!stats) {
    kafkaLogger.warn("driver.stats_missing", {
      driver_id: driverId,
      reason: "booking_confirmed",
    });
    return;
  }

  const tripDateTime = new Date(tripDate);
  const departureDateTime = new Date(departureTime);
  const now = new Date();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isFutureTrip = tripDateTime >= tomorrow;
  const isSameDayTrip = tripDateTime >= today && tripDateTime < tomorrow;
  const hasNotDeparted = isSameDayTrip && departureDateTime > now;

  kafkaLogger.debug("driver.booking_confirmed_classified", {
    driver_id: driverId,
    is_future_trip: isFutureTrip,
    is_same_day_trip: isSameDayTrip,
    has_not_departed: hasNotDeparted,
  });

  if (isFutureTrip || hasNotDeparted) {
    await db
      .update(driverStats)
      .set({
        pendingPayments: stats.pendingPayments + fareAmountMinor,
        totalPassengers: stats.totalPassengers + 1,
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, driverId));
    kafkaLogger.info("driver.stats_updated", {
      driver_id: driverId,
      update_type: "pending_payments_and_total_passengers",
    });
  } else {
    await db
      .update(driverStats)
      .set({
        totalPassengers: stats.totalPassengers + 1,
        updatedAt: new Date(),
      })
      .where(eq(driverStats.driverId, driverId));
    kafkaLogger.info("driver.stats_updated", {
      driver_id: driverId,
      update_type: "total_passengers_only",
    });
  }

  kafkaLogger.info("driver.booking_confirmed_processed", {
    driver_id: driverId,
  });
}

async function handlePayoutCompleted(value: Buffer) {
  const event = await decodeEvent<PayoutCompletedEvent>(value);
  const { driverId, amountMinor } = event.payload;

  kafkaLogger.info("driver.payout_completed_received", {
    driver_id: driverId,
    amount_minor: amountMinor,
  });

  const stats = await db.query.driverStats.findFirst({
    where: eq(driverStats.driverId, driverId),
  });

  if (!stats) {
    kafkaLogger.warn("driver.stats_missing", {
      driver_id: driverId,
      reason: "payout_completed",
    });
    return;
  }

  await db
    .update(driverStats)
    .set({
      totalEarnings: stats.totalEarnings + amountMinor,
      pendingPayments: Math.max(0, stats.pendingPayments - amountMinor),
      updatedAt: new Date(),
    })
    .where(eq(driverStats.driverId, driverId));

  kafkaLogger.info("driver.payout_completed_processed", {
    driver_id: driverId,
  });
}

async function handleDriverBankVerified(value: Buffer) {
  const event = await decodeEvent<DriverBankVerifiedEvent>(value);

  logger.info("driver.verification.received_verified", {
    driverId: event.payload.driverId,
    accountName: event.payload.accountName,
  });

  const [updatedDriver] = await db
    .update(driver)
    .set({
      bankName: event.payload.bankName,
      bankCode: event.payload.bankCode,
      accountNumber: event.payload.accountNumber,
      accountName: event.payload.accountName,
      bankVerificationStatus: "active",
      bankVerificationFailureReason: null,
      bankVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(driver.id, event.payload.driverId))
    .returning();

  if (updatedDriver) {
    await emitDriverPayoutProfileUpserted(updatedDriver);
  }
}

async function handleDriverBankVerificationFailed(value: Buffer) {
  const event = await decodeEvent<DriverBankVerificationFailedEvent>(value);

  logger.info("driver.verification.received_failed", {
    driverId: event.payload.driverId,
    reason: event.payload.reason,
  });

  const [updatedDriver] = await db
    .update(driver)
    .set({
      bankVerificationStatus: "failed",
      bankVerificationFailureReason: event.payload.reason,
      bankVerifiedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(driver.id, event.payload.driverId))
    .returning();

  if (updatedDriver) {
    await emitDriverPayoutProfileUpserted(updatedDriver);
  }
}

async function handleRouteCreated(event: RouteCreatedEvent) {
  const { driverId } = event.payload;

  kafkaLogger.info("driver.route_created_received", {
    driver_id: driverId,
  });

  const stats = await db.query.driverStats.findFirst({
    where: eq(driverStats.driverId, driverId),
  });

  if (!stats) {
    kafkaLogger.warn("driver.stats_missing", {
      driver_id: driverId,
      reason: "route_created",
    });
    return;
  }

  await db
    .update(driverStats)
    .set({
      activeRoutes: stats.activeRoutes + 1,
      updatedAt: new Date(),
    })
    .where(eq(driverStats.driverId, driverId));

  kafkaLogger.info("driver.route_created_processed", {
    driver_id: driverId,
  });
}

export async function handleRouteDeleted(event: RouteDeletedEvent) {
  const { driverId, routeId } = event.payload;

  kafkaLogger.info("driver.route_deleted_received", {
    driver_id: driverId,
    route_id: routeId,
  });

  const stats = await db.query.driverStats.findFirst({
    where: eq(driverStats.driverId, driverId),
  });

  if (!stats) {
    kafkaLogger.warn("driver.stats_missing", {
      driver_id: driverId,
      reason: "route_deleted",
    });
    return;
  }

  await db
    .update(driverStats)
    .set({
      activeRoutes: Math.max(0, stats.activeRoutes - 1),
      updatedAt: new Date(),
    })
    .where(eq(driverStats.driverId, driverId));

  kafkaLogger.info("driver.route_deleted_processed", {
    driver_id: driverId,
  });
}
