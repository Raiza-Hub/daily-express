import type { JWTPayload } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, payment } from "../db/index";
import { jobService } from "../workers/job.service";
import { logger } from "../utils/logger";
import { RouteRepository } from "./route.repository";
import { payoutService as sharedPayoutService } from "../payout/payout.service";
import { payoutRepository } from "../payout/payout.repository";
import { resolveDriverId } from "./utils";

export class TripService {
  private readonly payoutService = sharedPayoutService;

  constructor(private repo: RouteRepository) {}

  async completeTrip(user: JWTPayload, tripId: string) {
    const driverId = await resolveDriverId(user);
    const tripWithRoute = await this.repo.findTripWithOriginDestination(tripId);

    if (!tripWithRoute) {
      throw createServiceError("Trip not found", 404);
    }
    if (tripWithRoute.trip.driverId !== driverId) {
      throw createServiceError(
        "You are not authorized to complete this trip",
        403,
      );
    }
    if (tripWithRoute.trip.status === "cancelled") {
      throw createServiceError("Cancelled trips cannot be completed", 400);
    }

    if (!tripWithRoute.hasDeparted) {
      throw createServiceError(
        "Trip cannot be completed before the scheduled departure time",
        400,
      );
    }

    const result = await db.transaction(async (tx) => {
      const lockedTrip = await this.repo.lockTrip(tx, tripId);
      if (!lockedTrip) {
        throw createServiceError("Trip not found", 404);
      }
      if (lockedTrip.driverId !== driverId) {
        throw createServiceError(
          "You are not authorized to complete this trip",
          403,
        );
      }
      if (lockedTrip.status === "cancelled") {
        throw createServiceError("Cancelled trips cannot be completed", 400);
      }

      const updatedTrip = await this.repo.updateTrip(tx, tripId, {
        status: "completed",
        updatedAt: new Date(),
      });
      if (!updatedTrip) {
        throw createServiceError("Trip not found", 404);
      }

      return { updatedTrip };
    });

    try {
      await this.payoutService.triggerPayout(tripId);
    } catch (error) {
      logger.error("payout.trigger_after_complete.failed", { tripId, error });
    }

    return result.updatedTrip;
  }

  async getDriverTrips(user: JWTPayload, from: string, to: string) {
    const driverId = await resolveDriverId(user);
    const trips = await this.repo.findDriverTrips(driverId, from, to);
    return trips.map((t) => ({
      id: t.id,
      origin: t.origin,
      destination: t.destination,
      date: t.date,
      departureTime: t.departureTime,
      price: Number(t.price),
      tripStatus: t.tripStatus,
      status:
        t.tripStatus === "cancelled"
          ? "cancelled"
          : t.payoutStatus === "successful"
            ? "successful"
            : "pending",
    }));
  }

  async initiateTripPayout(user: JWTPayload, tripId: string) {
    const driverId = await resolveDriverId(user);
    const tripWithRoute = await this.repo.findTripWithOriginDestination(tripId);

    if (!tripWithRoute) {
      throw createServiceError("Trip not found", 404);
    }
    if (tripWithRoute.trip.driverId !== driverId) {
      throw createServiceError(
        "You are not authorized to withdraw from this trip",
        403,
      );
    }
    if (tripWithRoute.trip.status === "cancelled") {
      throw createServiceError("Cancelled trips cannot be paid out", 400);
    }
    if (tripWithRoute.trip.status !== "completed") {
      throw createServiceError(
        "Complete this trip before withdrawing",
        400,
      );
    }

    await this.payoutService.triggerPayout(tripId);

    // processTripPayout silently no-ops when the trip has no earnings, the
    // driver is not payout-eligible, or a payout already exists. Surface that
    // instead of reporting a payout that was never created.
    const payout = await payoutRepository.findLatestPayoutByTripId(tripId);
    if (!payout) {
      throw createServiceError(
        "This payout isn't available yet. Please check your bank verification status.",
        400,
      );
    }

    return tripWithRoute.trip;
  }

  async cancelTrip(user: JWTPayload, tripId: string) {
    const driverId = await resolveDriverId(user);
    const tripWithRoute = await this.repo.findTripWithOriginDestination(tripId);

    if (!tripWithRoute) {
      throw createServiceError("Trip not found", 404);
    }
    if (tripWithRoute.trip.driverId !== driverId) {
      throw createServiceError(
        "You are not authorized to cancel this trip",
        403,
      );
    }
    if (tripWithRoute.trip.status === "cancelled") {
      throw createServiceError("Trip is already cancelled", 400);
    }
    if (tripWithRoute.trip.status === "completed") {
      throw createServiceError("Completed trips cannot be cancelled", 400);
    }

    const result = await db.transaction(async (tx) => {
      const lockedTrip = await this.repo.lockTrip(tx, tripId);
      if (!lockedTrip) {
        throw createServiceError("Trip not found", 404);
      }
      if (lockedTrip.driverId !== driverId) {
        throw createServiceError(
          "You are not authorized to cancel this trip",
          403,
        );
      }
      if (lockedTrip.status === "cancelled") {
        throw createServiceError("Trip is already cancelled", 400);
      }
      if (lockedTrip.status === "completed") {
        throw createServiceError("Completed trips cannot be cancelled", 400);
      }

      const updatedTrip = await this.repo.updateTrip(tx, tripId, {
        status: "cancelled",
        updatedAt: new Date(),
      });
      if (!updatedTrip) {
        throw createServiceError("Trip not found", 404);
      }

      const confirmedBookings = await tx
        .select({
          bookingId: booking.id,
          paymentReference: payment.reference,
        })
        .from(booking)
        .innerJoin(payment, eq(payment.bookingId, booking.id))
        .where(
          and(
            eq(booking.tripId, tripId),
            eq(booking.status, "confirmed"),
            eq(payment.status, "successful"),
          ),
        );

      for (const b of confirmedBookings) {
        await jobService.enqueueTripRefund(tx, {
          bookingId: b.bookingId,
          paymentReference: b.paymentReference,
          refundReason: "Trip cancelled by driver",
        });
      }

      return { updatedTrip };
    });

    return result.updatedTrip;
  }
}

export const tripService = new TripService(new RouteRepository());
