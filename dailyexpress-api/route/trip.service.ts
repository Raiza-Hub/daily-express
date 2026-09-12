import type { JWTPayload } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { eq, ne, notInArray } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, trip } from "../db/index";
import { logger } from "../utils/logger";
import { HIDDEN_BOOKING_PAYMENT_STATUSES } from "../utils/route";
import { RouteRepository, routeRepository } from "./route.repository";
import { payoutService as sharedPayoutService } from "../payout/payout.service";
import { getTripArrivalAt, resolveDriverId } from "./utils";

export class TripService {
  private readonly payoutService = sharedPayoutService;

  constructor(private repo: RouteRepository) {}

  async completeTrip(user: JWTPayload, tripId: string) {
    const driverId = await resolveDriverId(user);
    const tripWithRoute = await this.repo.findTripWithRoute(tripId);

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

    const arrivalAt = getTripArrivalAt(tripWithRoute.trip);
    if (arrivalAt.getTime() > Date.now()) {
      throw createServiceError(
        "Trip cannot be completed before the scheduled arrival time",
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
        vehicleId: null,
        updatedAt: new Date(),
      });
      if (!updatedTrip) {
        throw createServiceError("Trip not found", 404);
      }

      await this.repo.updateBookingsByTrip(
        tx,
        tripId,
        { status: "completed", updatedAt: new Date() },
        [
          eq(booking.status, "confirmed"),
          notInArray(booking.paymentStatus, HIDDEN_BOOKING_PAYMENT_STATUSES),
        ],
      );

      await this.payoutService.markTripCompletedInTransaction(
        tx,
        { tripId, completedAt: new Date() },
      );

      return { updatedTrip };
    });

    try {
      await this.payoutService.triggerPayout(tripId);
    } catch (error) {
      logger.error("payout.trigger_after_complete.failed", { tripId, error });
    }

    return result.updatedTrip;
  }
}

export const tripService = new TripService(routeRepository);