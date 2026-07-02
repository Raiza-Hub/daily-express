import { renderEmail, getEmailSubject } from "@repo/email";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, earning, payment, route, trip, VEHICLE_CAPACITY } from "../db/index";
import { driverStats } from "../db/driver-schema";
import { getConfig } from "../config/index";
import { logger } from "../utils/logger";
import { formatAmountMinor } from "../utils/payout";
import { toMinorAmount } from "../utils/payment";
import { formatBusinessDate } from "../utils/route";
import { jobService } from "../workers/job.service";

import { RouteRepository } from "./route.repository";
import { sseManager } from "./sse-manager";

export class AllocationService {
  constructor(private repo: RouteRepository) {}

  async allocateBooking(bookingId: string, reference: string) {
    const bookingRecord = await this.repo.findBookingById(bookingId);
    if (!bookingRecord) {
      logger.warn("allocation.booking_not_found", { bookingId, reference });
      return;
    }

    if (bookingRecord.tripId) {
      logger.info("allocation.already_allocated", { bookingId, reference, tripId: bookingRecord.tripId });
      return;
    }

    if (bookingRecord.expiresAt && bookingRecord.expiresAt <= new Date()) {
      logger.warn("allocation.booking_expired", { bookingId, reference });
      return;
    }

    let routeRecord: { id: string; departure_time: string; priceCar: number; priceBus: number; pickup_location_title: string; dropoff_location_title: string; meeting_point: string } | undefined;
    const found = await db.query.route.findFirst({
      where: eq(route.id, bookingRecord.routeId),
    });
    if (!found) {
      logger.error("allocation.route_not_found", {
        bookingId,
        routeId: bookingRecord.routeId,
        reference,
      });
      return;
    }
    routeRecord = found;

    const passengerUser = bookingRecord.userId ? await this.repo.findUserById(bookingRecord.userId) : null;
    let emailHtml: string | null = null;
    let emailSubject: string | null = null;
    let passengerEmail: string | null = null;
    if (passengerUser?.email) {
      passengerEmail = passengerUser.email;
      const config = getConfig();
      const propsJson = JSON.stringify({
        frontendUrl: config.FRONTEND_URL,
        passengerName: `${bookingRecord.firstName ?? ""} ${bookingRecord.lastName ?? ""}`.trim() || null,
        paymentReference: reference,
        pricePaid: formatAmountMinor(bookingRecord.fareAmount, "NGN"),
        pickupTitle: routeRecord.pickup_location_title,
        dropoffTitle: routeRecord.dropoff_location_title,
        tripDate: formatBusinessDate(bookingRecord.tripDate),
        departureTime: routeRecord.departure_time,
        timeZone: "Africa/Lagos",
        meetingPoint: routeRecord.meeting_point,
      });
      emailHtml = await renderEmail("BookingConfirmedEmail", propsJson);
      emailSubject = getEmailSubject("BookingConfirmedEmail", propsJson);
    }

    const tripDateStr = bookingRecord.tripDate instanceof Date
      ? bookingRecord.tripDate.toISOString()
      : String(bookingRecord.tripDate);

    const result = await db.transaction(async (tx) => {
      // Serialize concurrent trip allocations/creations for the same route+date+vehicleType
      // using a Postgres advisory lock scoped to the composite key.
      // Different vehicle types on the same route do NOT block each other.
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtext(concat(${bookingRecord.routeId}, ${tripDateStr}, ${bookingRecord.vehicleType}))::bigint
        )
      `);

      await tx
        .update(payment)
        .set({
          status: "successful",
          providerStatus: "success",
          lastStatusCheckAt: new Date(),
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(payment.reference, reference), eq(payment.status, "processing")));

      const bestTripRow = (await tx.execute(sql`
        SELECT t.id, t.route_id, t.date, t.vehicle_type, t.capacity, t.booked_seats,
               t.status, t.driver_id, t.driver_claimed_at, t.vehicle_id,
               t.created_at, t.updated_at
        FROM ${trip} t
        WHERE t.route_id = ${bookingRecord.routeId}
          AND t.date = ${bookingRecord.tripDate}
          AND t.vehicle_type = ${bookingRecord.vehicleType}
          AND t.booked_seats < t.capacity
          AND t.status IN ('awaiting_driver', 'pending', 'confirmed')
        ORDER BY (t.booked_seats::float / t.capacity) DESC
        LIMIT 1
        FOR UPDATE
      `)) as Array<{
        id: string; route_id: string; date: Date; vehicle_type: string;
        capacity: number; booked_seats: number; status: string;
        driver_id: string | null; driver_claimed_at: Date | null;
        vehicle_id: string | null; created_at: Date; updated_at: Date;
      }>;

      let tripId: string;
      let tripCapacity: number;
      let tripDriverId: string | null;

      if (bestTripRow.length > 0) {
        tripId = bestTripRow[0].id;
        tripCapacity = bestTripRow[0].capacity;
        tripDriverId = bestTripRow[0].driver_id;
      } else {
        const capacity = VEHICLE_CAPACITY[bookingRecord.vehicleType] ?? 40;
        const newTripRows = (await tx.execute(sql`
          INSERT INTO ${trip} (route_id, date, vehicle_type, capacity, booked_seats, status, created_at, updated_at)
          VALUES (${bookingRecord.routeId}, ${bookingRecord.tripDate}, ${bookingRecord.vehicleType}, ${capacity}, 0, 'awaiting_driver', now(), now())
          RETURNING id, capacity, driver_id
        `)) as Array<{ id: string; capacity: number; driver_id: null }>;

        if (newTripRows.length === 0) throw new Error("Failed to create trip for allocation");
        tripId = newTripRows[0].id;
        tripCapacity = newTripRows[0].capacity;
        tripDriverId = null;
      }

      const seatRows = (await tx.execute(sql`
        SELECT s AS seat_number
        FROM generate_series(1, ${tripCapacity}) s
        WHERE NOT EXISTS (
          SELECT 1 FROM ${booking} b
          WHERE b.trip_id = ${tripId}
            AND b.seat_number = s
            AND b.status = 'confirmed'
        )
        ORDER BY s
        LIMIT 1
      `)) as Array<{ seat_number: number }>;

      if (seatRows.length === 0) throw new Error("No available seat on trip");
      const seatNumber = seatRows[0].seat_number;

      const [updatedBooking] = await tx
        .update(booking)
        .set({
          tripId,
          seatNumber,
          status: "confirmed",
          paymentStatus: "successful",
          paymentReference: reference,
          updatedAt: new Date(),
        })
        .where(and(eq(booking.id, bookingId), eq(booking.status, "pending")))
        .returning();

      if (!updatedBooking) {
        logger.info("allocation.booking_already_confirmed_in_tx", { bookingId, reference });
        return {
          tripId,
          seatNumber: bookingRecord.seatNumber || seatNumber,
          capacity: tripCapacity,
          bookedSeats: bestTripRow.length > 0 ? bestTripRow[0].booked_seats : 0,
        };
      }

      await tx
        .execute(sql`UPDATE ${trip} SET booked_seats = booked_seats + 1, updated_at = now() WHERE id = ${tripId}`);

      const newBookedSeats = (bestTripRow.length > 0 ? bestTripRow[0].booked_seats : 0) + 1;

      if (tripDriverId) {
        const minor = toMinorAmount(bookingRecord.fareAmount);
        await tx.execute(sql`
          INSERT INTO ${earning} (driver_id, booking_id, trip_id, route_id, trip_date,
            gross_amount_minor, fee_amount_minor, net_amount_minor,
            currency, status, source_event_id, created_at, updated_at)
          VALUES (${tripDriverId}, ${bookingId}, ${tripId}, ${bookingRecord.routeId},
            ${bookingRecord.tripDate}, ${minor}, 0, ${minor},
            'NGN', 'pending_trip_completion', ${`payment:${reference}:allocation-driver-present`}, now(), now())
        `);
        await tx.execute(sql`
          UPDATE ${driverStats}
          SET pending_payments = pending_payments + ${minor},
              total_passengers = total_passengers + 1,
              updated_at = now()
          WHERE driver_id = ${tripDriverId}
        `);
      }

      if (passengerEmail && emailHtml && emailSubject) {
        await jobService.enqueueEmail(tx, "email.booking_confirmed", {
          to: passengerEmail,
          subject: emailSubject,
          html: emailHtml,
        });
      }

      return { tripId, seatNumber, capacity: tripCapacity, bookedSeats: newBookedSeats };
    });

    sseManager.broadcast("trip_update", {
      tripId: result.tripId,
      bookedSeats: result.bookedSeats,
      capacity: result.capacity,
      vehicleType: bookingRecord.vehicleType,
      routeId: bookingRecord.routeId,
    });

    logger.info("allocation.completed", {
      bookingId,
      tripId: result.tripId,
      seatNumber: result.seatNumber,
    });
  }
}
