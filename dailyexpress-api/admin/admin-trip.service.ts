import { createServiceError } from "@shared/utils";
import { eq, isNull } from "drizzle-orm";
import { getConfig } from "../config/index";
import { db } from "../db/connection";
import {
  driver,
  trip,
  vehicle,
  type RouteRecord,
} from "../db/index";
import { paymentRepository } from "../payment/payment.repository";
import { RouteRepository, routeRepository } from "../route/route.repository";
import { logger } from "../utils/logger";
import { generateReference } from "../utils/payment";
import { formatBusinessDate, getScheduledDepartureTime } from "../utils/route";
import { jobService } from "../workers/job.service";

export class AdminTripService {
  private readonly paymentRepo = paymentRepository;

  constructor(private repo: RouteRepository) {}

  async getPendingTrips() {
    const trips = await this.repo.findTripsWithRoute([
      eq(trip.status, "awaiting_driver"),
      isNull(trip.driverId),
    ]);

    const now = new Date();
    return trips
      .filter(({ trip: t }) => {
        const dateKey = formatBusinessDate(t.date);
        const scheduledDeparture = getScheduledDepartureTime(
          dateKey,
          t.departureTime,
        );
        return scheduledDeparture > now;
      })
      .map(({ trip: t, route: r }) => ({
        tripId: t.id,
        date: t.date,
        capacity: t.capacity,
        bookedSeats: t.bookedSeats,
        status: t.status,
        createdAt: t.createdAt,
        route: this.toRouteSummary(r),
      }));
  }

private toRouteSummary(r: RouteRecord) {
    return {
      id: r.id,
      origin_title: r.origin_title,
      origin_locality: r.origin_locality,
      origin_label: r.origin_label,
      destination_title: r.destination_title,
      destination_locality: r.destination_locality,
      destination_label: r.destination_label,
      train_station_title: r.train_station_title,
      train_station_locality: r.train_station_locality,
      train_station_label: r.train_station_label,
      pickup_point: r.pickup_point,
      dropoff_point: r.dropoff_point,
      departure_time: r.departure_time,
      arrival_time: r.arrival_time,
      price: r.price,
      luggage_fee: r.luggage_fee,
    };
  }

  async assignPlatformDriver(
    tripId: string,
    driverId: string,
    adminEmail: string,
    vehicleId?: string,
  ) {
    const driverRecord = await this.repo.findDriverById(driverId);
    if (!driverRecord) {
      throw createServiceError("Driver not found", 404);
    }

    const tripWithRoute = await this.repo.findTripWithRoute(tripId);
    if (!tripWithRoute) {
      throw createServiceError("Trip not found", 404);
    }
    const { trip: tripRecord } = tripWithRoute;

    if (tripRecord.driverId) {
      throw createServiceError("Trip already has a driver assigned", 409);
    }
    if (
      tripRecord.status === "cancelled" ||
      tripRecord.status === "completed"
    ) {
      throw createServiceError(`Trip is already ${tripRecord.status}`, 400);
    }

    const dateKey = formatBusinessDate(tripRecord.date);
    const scheduledDeparture = getScheduledDepartureTime(
      dateKey,
      tripRecord.departureTime,
    );
    if (scheduledDeparture <= new Date()) {
      throw createServiceError(
        "This trip has already departed and can no longer be assigned",
        400,
      );
    }

    await db.transaction(async (tx) => {
      // Lock and check the driver row FOR UPDATE to prevent deactivation/status changes race conditions
      const [lockedDriver] = await tx
        .select()
        .from(driver)
        .where(eq(driver.id, driverId))
        .for("update");

      if (!lockedDriver) {
        throw createServiceError("Driver not found", 404);
      }
      if (!lockedDriver.isActive) {
        throw createServiceError("Driver account is deactivated", 403);
      }
      if (lockedDriver.bankVerificationStatus !== "active") {
        throw createServiceError(
          "Driver bank account must be verified before assignment",
          403,
        );
      }

      // Lock the trip row to serialize against concurrent driver assignment
      const lockedTrip = await this.repo.lockTrip(tx, tripId);
      if (!lockedTrip) {
        throw createServiceError("Trip not found", 404);
      }
      if (lockedTrip.driverId) {
        throw createServiceError("Trip already has a driver assigned", 409);
      }
      if (
        lockedTrip.status === "cancelled" ||
        lockedTrip.status === "completed"
      ) {
        throw createServiceError(`Trip is already ${lockedTrip.status}`, 400);
      }

      if (vehicleId) {
        // 1. Lock the vehicle record FOR UPDATE
        const [lockedVehicle] = await tx
          .select()
          .from(vehicle)
          .where(eq(vehicle.id, vehicleId))
          .for("update");
        if (!lockedVehicle) {
          throw createServiceError("Vehicle not found", 404);
        }
        if (lockedVehicle.driverId !== driverId) {
          throw createServiceError(
            "Vehicle does not belong to this driver",
            403,
          );
        }
        // 2. Perform conflict check inside the transaction
        const conflict = await this.repo.findVehicleScheduledAtDeparture(
          tx,
          driverId,
          vehicleId,
          tripRecord.date,
          tripRecord.departureTime,
          tripRecord.arrivalTime,
          tripId,
        );
        if (conflict) {
          throw createServiceError(
            "This vehicle is already scheduled for another trip at this departure time",
            409,
          );
        }

        if (lockedVehicle.capacity < tripRecord.capacity) {
          throw createServiceError(
            `Vehicle capacity (${lockedVehicle.capacity}) is insufficient for this trip (${tripRecord.capacity})`,
            400,
          );
        }
      }

      const updated = await this.repo.assignDriverToTrip(
        tx,
        tripId,
        driverId,
        vehicleId,
      );
      if (!updated) {
        throw createServiceError("Failed to assign driver to trip", 500);
      }
    });

    const updatedTrip = await this.repo.findTripById(tripId);
    if (!updatedTrip) {
      throw createServiceError("Failed to assign driver to trip", 500);
    }

    logger.info("trip.admin_assign_platform_driver", {
      tripId,
      driverId,
      adminEmail,
      vehicleId,
    });
    return updatedTrip;
  }

  async refundTripPassengers(
    tripId: string,
    adminEmail: string,
    reason?: "no_driver_found" | "admin_cancelled",
  ) {
    const refundReason =
      reason === "admin_cancelled"
        ? "Trip cancelled by admin"
        : "Trip cancelled — driver unavailable";

    const result = await db.transaction(async (tx) => {
      const lockedTrip = await this.repo.lockTrip(tx, tripId);
      if (!lockedTrip) {
        throw createServiceError("Trip not found", 404);
      }
      if (lockedTrip.status === "cancelled") {
        throw createServiceError("Trip already cancelled", 400);
      }

      const successfulBookings =
        await this.repo.findSuccessfulBookingsByTripId(tripId);

      if (successfulBookings.length === 0) {
        throw createServiceError(
          "No successful bookings found for this trip",
          400,
        );
      }

      const bookingIds = successfulBookings.map((b) => b.id);
      const paymentRecords =
        await this.paymentRepo.findPaymentsByBookingIds(bookingIds);
      const paymentMap = new Map(paymentRecords.map((p) => [p.bookingId, p]));

      await this.repo.updateTrip(tx, tripId, {
        status: "cancelled",
        vehicleId: null,
        updatedAt: new Date(),
      });

      for (const bk of successfulBookings) {
        const paymentRecord = paymentMap.get(bk.id);
        if (!paymentRecord) continue;

        await jobService.enqueueTripRefund(tx, {
          bookingId: bk.id,
          paymentReference: paymentRecord.reference,
          refundReference: generateReference(),
          refundReason,
          emailReason: reason ?? "admin_cancelled",
        });
      }

      return {
        tripId,
        totalBookings: successfulBookings.length,
        message: "Trip cancelled. Refund jobs enqueued for processing.",
      };
    });

    logger.info("trip.admin_refund", {
      tripId,
      adminEmail,
      totalBookings: result.totalBookings,
      reason,
    });

    return {
      tripId: result.tripId,
      message: result.message,
    };
  }
}

export const adminTripService = new AdminTripService(routeRepository);
