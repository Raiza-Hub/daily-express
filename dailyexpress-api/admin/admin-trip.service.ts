import { getEmailSubject, renderEmail } from "@repo/email";
import { createServiceError } from "@shared/utils";
import { eq, isNull } from "drizzle-orm";
import { getConfig } from "../config/index";
import { db, type DbTransaction } from "../db/connection";
import {
  driver,
  externalDriver as externalDriverTable,
  trip,
  vehicle,
} from "../db/index";
import { driverRepository } from "../driver/driver.repository";
import { paymentRepository } from "../payment/payment.repository";
import { RouteRepository, routeRepository } from "../route/route.repository";
import { logger } from "../utils/logger";
import { generateReference } from "../utils/payment";
import { formatBusinessDate, getScheduledDepartureTime } from "../utils/route";
import { jobService } from "../workers/jobService";
type ExternalDriverInsert = typeof externalDriverTable.$inferInsert;

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
      .filter(({ trip: t, route: r }) => {
        const dateKey = formatBusinessDate(t.date);
        const scheduledDeparture = getScheduledDepartureTime(
          dateKey,
          r.departure_time,
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
        route: {
          id: r.id,
          pickup_location_title: r.pickup_location_title,
          pickup_location_locality: r.pickup_location_locality,
          pickup_location_label: r.pickup_location_label,
          dropoff_location_title: r.dropoff_location_title,
          dropoff_location_locality: r.dropoff_location_locality,
          dropoff_location_label: r.dropoff_location_label,
          departure_time: r.departure_time,
          arrival_time: r.arrival_time,
          priceCar: r.priceCar,
          priceBus: r.priceBus,
        },
      }));
  }

  async getOverdueTrips() {
    const trips = await this.repo.findTripsWithRoute([
      eq(trip.status, "awaiting_driver"),
      isNull(trip.driverId),
    ]);

    const now = new Date();
    return trips
      .filter(({ trip: t, route: r }) => {
        const dateKey = formatBusinessDate(t.date);
        const scheduledDeparture = getScheduledDepartureTime(
          dateKey,
          r.departure_time,
        );
        return scheduledDeparture <= now;
      })
      .map(({ trip: t, route: r }) => ({
        tripId: t.id,
        date: t.date,
        capacity: t.capacity,
        bookedSeats: t.bookedSeats,
        status: t.status,
        createdAt: t.createdAt,
        route: {
          id: r.id,
          pickup_location_title: r.pickup_location_title,
          pickup_location_locality: r.pickup_location_locality,
          pickup_location_label: r.pickup_location_label,
          dropoff_location_title: r.dropoff_location_title,
          dropoff_location_locality: r.dropoff_location_locality,
          dropoff_location_label: r.dropoff_location_label,
          departure_time: r.departure_time,
          arrival_time: r.arrival_time,
          priceCar: r.priceCar,
          priceBus: r.priceBus,
        },
      }));
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
    const { trip: tripRecord, route: routeRecord } = tripWithRoute;

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
      routeRecord.departure_time,
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

      // Lock the trip row to serialize against concurrent assignExternalDriver / claimTrip
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

      // Prevent assigning if an external driver is already assigned
      const existingExternal = await tx.query.externalDriver.findFirst({
        where: eq(externalDriverTable.tripId, tripId),
      });
      if (existingExternal) {
        throw createServiceError(
          "This trip already has an external driver assigned",
          409,
        );
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
          routeRecord.departure_time,
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

      await this.sendDriverAssignedEmail(tx, tripId, driverId, vehicleId);
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

  async assignExternalDriver(
    tripId: string,
    data: {
      firstName: string;
      lastName: string;
      phone: string;
      country?: string;
      state?: string;
      vehicleMake?: string;
      vehicleModel?: string;
      vehiclePlateNumber?: string;
      vehicleColor?: string;
      vehicleCapacity?: number;
    },
    adminEmail: string,
  ) {
    const tripRecord = await this.repo.findTripById(tripId);
    if (!tripRecord) {
      throw createServiceError("Trip not found", 404);
    }
    if (tripRecord.driverId) {
      throw createServiceError(
        "Trip already has a platform driver assigned",
        409,
      );
    }

    await db.transaction(async (tx) => {
      const lockedTrip = await this.repo.lockTrip(tx, tripId);
      if (!lockedTrip) throw createServiceError("Trip not found", 404);
      if (lockedTrip.driverId)
        throw createServiceError(
          "Trip already has a platform driver assigned",
          409,
        );

      const existingExternal = await tx.query.externalDriver.findFirst({
        where: eq(externalDriverTable.tripId, tripId),
      });
      if (existingExternal)
        throw createServiceError(
          "Trip already has an external driver assigned",
          409,
        );

      const externalData: ExternalDriverInsert = {
        tripId,
        name: `${data.firstName} ${data.lastName}`.trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        assignedBy: adminEmail,
      };

      if (data.country) externalData.country = data.country;
      if (data.state) externalData.state = data.state;
      if (data.vehicleMake) externalData.vehicleMake = data.vehicleMake;
      if (data.vehicleModel) externalData.vehicleModel = data.vehicleModel;
      if (data.vehiclePlateNumber)
        externalData.vehiclePlateNumber = data.vehiclePlateNumber;
      if (data.vehicleColor) externalData.vehicleColor = data.vehicleColor;
      if (data.vehicleCapacity)
        externalData.vehicleCapacity = data.vehicleCapacity;

      await this.repo.insertExternalDriver(tx, externalData);

      await this.repo.updateTrip(tx, tripId, {
        status: "confirmed",
        driverClaimedAt: new Date(),
        updatedAt: new Date(),
      });

      await this.sendDriverAssignedExternalEmail(tx, tripId, data, adminEmail);
    });

    const externalDriver = await this.repo.findExternalDriverByTripId(tripId);

    logger.info("trip.admin_assign_external_driver", {
      tripId,
      adminEmail,
    });
    return { trip: tripRecord, externalDriver };
  }

  private async sendDriverAssignedExternalEmail(
    tx: DbTransaction,
    tripId: string,
    data: {
      firstName: string;
      lastName: string;
      phone: string;
      vehicleMake?: string;
      vehicleModel?: string;
      vehiclePlateNumber?: string;
      vehicleColor?: string;
    },
    adminEmail: string,
  ) {
    const tripWithRoute = await this.repo.findTripWithRoute(tripId);
    if (!tripWithRoute) return;

    const { route: routeRecord } = tripWithRoute;
    const successfulBookings =
      await this.repo.findSuccessfulBookingsByTripId(tripId);

    if (successfulBookings.length === 0) {
      throw createServiceError(
        "No successful bookings found for this trip",
        400,
      );
    }

    const config = getConfig();
    const dateKey = formatBusinessDate(tripWithRoute.trip.date);

    const userIds = successfulBookings.map((b) => b.userId);
    const users =
      userIds.length > 0 ? await this.repo.findUsersByIds(userIds) : [];
    const userByUserId = new Map(users.map((u) => [u.id, u]));

    for (const bk of successfulBookings) {
      const passengerUser = userByUserId.get(bk.userId);
      if (!passengerUser?.email) continue;

      const propsJson = JSON.stringify({
        frontendUrl: config.FRONTEND_URL,
        passengerName: `${bk.firstName} ${bk.lastName}`,
        driverName: `${data.firstName} ${data.lastName}`.trim(),
        driverPhone: data.phone,
        vehicleMake: data.vehicleMake ?? "",
        vehicleModel: data.vehicleModel ?? "",
        vehiclePlateNumber: data.vehiclePlateNumber ?? "",
        vehicleColor: data.vehicleColor ?? "",
        pickupTitle: routeRecord.pickup_location_title,
        dropoffTitle: routeRecord.dropoff_location_title,
        departureTime: routeRecord.departure_time,
        tripDate: dateKey,
        timeZone: "Africa/Lagos",
      });

      const html = await renderEmail("DriverAssignedEmail", propsJson);

      await jobService.enqueueEmail(tx, "email.driver_assigned", {
        to: passengerUser.email,
        subject: getEmailSubject("DriverAssignedEmail", propsJson),
        html,
      });
    }
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

      const vehicleId = lockedTrip.vehicleId;

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

  private async sendDriverAssignedEmail(
    tx: DbTransaction,
    tripId: string,
    driverId: string,
    vehicleId?: string,
  ) {
    const tripWithRoute = await this.repo.findTripWithRoute(tripId);
    if (!tripWithRoute) return;

    const { route: routeRecord } = tripWithRoute;
    const successfulBookings =
      await this.repo.findSuccessfulBookingsByTripId(tripId);

    if (successfulBookings.length === 0) {
      throw createServiceError(
        "No successful bookings found for this trip",
        400,
      );
    }

    const driverRecord = await this.repo.findDriverById(driverId);
    if (!driverRecord) return;

    const userRecord = await this.repo.findUserById(driverRecord.userId);
    if (!userRecord) return;

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

    const config = getConfig();
    const dateKey = formatBusinessDate(tripWithRoute.trip.date);

    const userIds = successfulBookings.map((b) => b.userId);
    const users =
      userIds.length > 0 ? await this.repo.findUsersByIds(userIds) : [];
    const userByUserId = new Map(users.map((u) => [u.id, u]));

    for (const bk of successfulBookings) {
      const passengerUser = userByUserId.get(bk.userId);
      if (!passengerUser?.email) continue;

      const propsJson = JSON.stringify({
        frontendUrl: config.FRONTEND_URL,
        passengerName: `${bk.firstName} ${bk.lastName}`,
        driverName: `${userRecord.firstName} ${userRecord.lastName}`,
        driverPhone: driverRecord.phone,
        vehicleMake,
        vehicleModel,
        vehiclePlateNumber,
        vehicleColor,
        pickupTitle: routeRecord.pickup_location_title,
        dropoffTitle: routeRecord.dropoff_location_title,
        departureTime: routeRecord.departure_time,
        tripDate: dateKey,
        timeZone: "Africa/Lagos",
      });

      const html = await renderEmail("DriverAssignedEmail", propsJson);

      await jobService.enqueueEmail(tx, "email.driver_assigned", {
        to: passengerUser.email,
        subject: getEmailSubject("DriverAssignedEmail", propsJson),
        html,
      });
    }
  }
}

export const adminTripService = new AdminTripService(routeRepository);
