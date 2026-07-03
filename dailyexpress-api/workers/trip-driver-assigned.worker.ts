import { and, eq, sql } from "drizzle-orm";
import { logger } from "../utils/logger";
import { db } from "../db/connection";
import { booking, driver, earning, route, trip, users } from "../db/index";
import { driverRepository } from "../driver/driver.repository";
import { routeRepository } from "../route/route.repository";
import { notificationService } from "../notification/notification.service";
import type { DriverNotification } from "@shared/types";
import { publishNotificationCreated } from "../notification/realtime";
import { jobService } from "./job.service";
import { getBoss, QUEUES, type TripDriverAssignedJobData } from "./boss";
import { renderEmail, getEmailSubject } from "@repo/email";
import { toMinorAmount } from "../utils/payment";

const repo = routeRepository;


export async function registerTripDriverAssignedWorker() {
  const boss = await getBoss();

  await boss.work<TripDriverAssignedJobData>(
    QUEUES.TRIP_DRIVER_ASSIGNED,
    {
      batchSize: 1,
      localConcurrency: 5,
      pollingIntervalSeconds: 2,
      heartbeatRefreshSeconds: 30,
    },
    async ([job]) => {
      logger.info("worker.trip_driver_assigned.started", {
        jobId: job.id,
        tripId: job.data.tripId,
        driverId: job.data.driverId,
      });

      try {
        await processTripDriverAssigned(job.data);
      } catch (error) {
        logger.error("worker.trip_driver_assigned.failed", {
          jobId: job.id,
          tripId: job.data.tripId,
          driverId: job.data.driverId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  );
}

async function processTripDriverAssigned(data: TripDriverAssignedJobData) {
  const { tripId, driverId, vehicleId } = data;

  const tripWithRoute = await repo.findTripWithRoute(tripId);
  if (!tripWithRoute) {
    logger.warn("worker.trip_driver_assigned.trip_not_found", { tripId });
    return;
  }

  if (tripWithRoute.trip.status === "cancelled") {
    logger.warn("worker.trip_driver_assigned.trip_cancelled", { tripId });
    return;
  }

  const confirmedBookings = await repo.findBookingsByTripId(tripId);
  const payableBookings = confirmedBookings.filter(
    (b) => b.status === "confirmed" && b.paymentStatus === "successful",
  );

  if (payableBookings.length === 0) {
    logger.info("worker.trip_driver_assigned.no_payable_bookings", { tripId });
    return;
  }

  let createdCount = 0;
  let driverNotification: DriverNotification | undefined;

  await db.transaction(async (tx) => {
    for (const bk of payableBookings) {
      const existing = await tx.query.earning.findFirst({
        where: eq(earning.bookingId, bk.id),
      });
      if (existing) continue;

      const minor = toMinorAmount(bk.fareAmount);

      const insertResult = (await tx.execute(sql`
        INSERT INTO earning (
          driver_id, booking_id, trip_id, route_id, trip_date,
          pickup_title, dropoff_title,
          gross_amount_minor, fee_amount_minor, net_amount_minor,
          currency, status, source_event_id, created_at, updated_at
        ) VALUES (
          ${driverId}, ${bk.id}, ${tripId},
          ${tripWithRoute.route.id}, ${tripWithRoute.trip.date.toISOString()},
          ${tripWithRoute.route.pickup_location_title},
          ${tripWithRoute.route.dropoff_location_title},
          ${minor}, 0, ${minor},
          'NGN', 'pending_trip_completion',
          ${`booking:${bk.id}:driver-assigned`},
          now(), now()
        )
        ON CONFLICT (booking_id) DO NOTHING
        RETURNING id
      `)) as { id: string }[];

      if (insertResult.length === 0) {
        continue;
      }

      await tx.execute(sql`
        UPDATE driver_stats
        SET
          pending_payments = pending_payments + ${minor},
          total_passengers = total_passengers + 1,
          updated_at = now()
        WHERE driver_id = ${driverId}
      `);

      createdCount++;
    }

    driverNotification = await notificationService.createForDriverInTransaction(tx, driverId, {
      notificationKey: `trip:${tripId}:driver-assigned-passengers`,
      kind: "event",
      type: "trip_passengers_assigned",
      title: "Passengers Assigned",
      message: `${payableBookings.length} passenger(s) assigned to your upcoming trip`,
      href: `/driver/trips/${tripId}`,
      tag: "New",
      tone: "positive",
      metadata: {
        tripId,
        passengerCount: payableBookings.length,
      },
      occurredAt: new Date(),
    });
  });

  if (driverNotification) {
    await publishNotificationCreated(driverNotification);
  }

  const driverRecord = await repo.findDriverById(driverId);
  const driverUser = driverRecord
    ? await repo.findUserById(driverRecord.userId)
    : null;

  let vehicleMake = "";
  let vehicleModel = "";
  let vehiclePlateNumber = "";
  let vehicleColor = "";

  if (vehicleId) {
    const vehicleRecord = await driverRepository.findVehicleById(vehicleId);
    if (vehicleRecord) {
      vehicleMake = vehicleRecord.make;
      vehicleModel = vehicleRecord.model;
      vehiclePlateNumber = vehicleRecord.plateNumber;
      vehicleColor = vehicleRecord.color;
    }
  }

  const userIds = payableBookings.map((b) => b.userId);
  const users = userIds.length > 0 ? await repo.findUsersByIds(userIds) : [];
  const userByUserId = new Map(users.map((u) => [u.id, u]));

  for (const bk of payableBookings) {
    const passengerUser = userByUserId.get(bk.userId);
    if (!passengerUser?.email) continue;

    const propsJson = JSON.stringify({
      frontendUrl: process.env.FRONTEND_URL ?? "",
      passengerName: `${bk.firstName ?? ""} ${bk.lastName ?? ""}`.trim(),
      driverName: driverUser
        ? `${driverUser.firstName} ${driverUser.lastName}`.trim()
        : "",
      driverPhone: driverRecord?.phone ?? "",
      vehicleMake,
      vehicleModel,
      vehiclePlateNumber,
      vehicleColor,
      pickupTitle: tripWithRoute.route.pickup_location_title,
      dropoffTitle: tripWithRoute.route.dropoff_location_title,
      departureTime: tripWithRoute.route.departure_time,
      tripDate: tripWithRoute.trip.date,
      timeZone: "Africa/Lagos",
    });

    const html = await renderEmail("DriverAssignedEmail", propsJson);

    await db.transaction(async (tx) => {
      await jobService.enqueueEmail(tx, "email.driver_assigned", {
        to: passengerUser.email!,
        subject: getEmailSubject("DriverAssignedEmail", propsJson),
        html,
      });
    });
  }

  logger.info("worker.trip_driver_assigned.completed", {
    tripId,
    driverId,
    earningsCreated: createdCount,
    emailsSent: payableBookings.length,
  });
}
