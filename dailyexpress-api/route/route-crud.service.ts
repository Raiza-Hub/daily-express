import type { CreateRoute, JWTPayload, Route, updateRouteRequest } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { db } from "../db/connection";
import { route } from "../db/index";
import { DriverService } from "../driver/driverService";
import { isConstraintError, mapDriverToRouteDriver } from "../utils/route";
import { RouteRepository } from "./route.repository";
import { resolveDriverId, resolveDriverRecord, ROUTE_DUPLICATE_CONSTRAINT } from "./utils";

type RouteRecord = typeof route.$inferSelect;
type DriverRecord = typeof import("../db/index").driver.$inferSelect;

export class RouteCrudService {
  private readonly driverService = new DriverService();

  constructor(private repo: RouteRepository) {}

  async createRoute(user: JWTPayload, routeData: CreateRoute): Promise<Route> {
    const driverRecord = await resolveDriverRecord(user);

    const existingRoute = await this.repo.findRouteConflict({
      driverId: driverRecord.id,
      pickup_location_title: routeData.pickup_location_title,
      pickup_location_locality: routeData.pickup_location_locality,
      pickup_location_label: routeData.pickup_location_label,
      dropoff_location_title: routeData.dropoff_location_title,
      dropoff_location_locality: routeData.dropoff_location_locality,
      dropoff_location_label: routeData.dropoff_location_label,
      departure_time: routeData.departure_time,
    });

    if (existingRoute) {
      throw createServiceError("Route already exists", 400);
    }

    let newRoute: RouteRecord;
    try {
      newRoute = await db.transaction(async (tx) => {
        const record = await this.repo.insertRoute(tx, {
          ...routeData,
          driverId: driverRecord.id,
        });

        await this.driverService.recordRouteStatusChange(tx, {
          driverId: driverRecord.id,
          previousStatus: null,
          nextStatus: record.status,
        });
        return record;
      });
    } catch (error) {
      if (isConstraintError(error, ROUTE_DUPLICATE_CONSTRAINT)) {
        throw createServiceError("Route already exists", 400);
      }
      throw error;
    }

    return this.buildRouteResponse(newRoute, newRoute.availableSeats, driverRecord);
  }

  async getAllDriverRoutes(user: JWTPayload): Promise<Route[]> {
    const driverRecord = await resolveDriverRecord(user);
    const routes = await this.repo.findRoutesByDriverId(driverRecord.id);

    return routes.map((record) => ({
      ...record,
      remainingSeats: record.availableSeats,
      driver: mapDriverToRouteDriver(driverRecord),
    }));
  }

  async updateRoute(
    user: JWTPayload,
    routeId: string,
    routeData: updateRouteRequest,
  ): Promise<Route> {
    const driverId = await resolveDriverId(user);
    const existingRoute = await this.repo.findRouteById(routeId);

    if (!existingRoute) {
      throw createServiceError("Route not found", 404);
    }
    if (existingRoute.driverId !== driverId) {
      throw createServiceError(
        "You are not authorized to update this route",
        403,
      );
    }

    const nextRouteValues = {
      pickup_location_title:
        routeData.pickup_location_title ?? existingRoute.pickup_location_title,
      pickup_location_locality:
        routeData.pickup_location_locality ??
        existingRoute.pickup_location_locality,
      pickup_location_label:
        routeData.pickup_location_label ?? existingRoute.pickup_location_label,
      dropoff_location_title:
        routeData.dropoff_location_title ??
        existingRoute.dropoff_location_title,
      dropoff_location_locality:
        routeData.dropoff_location_locality ??
        existingRoute.dropoff_location_locality,
      dropoff_location_label:
        routeData.dropoff_location_label ??
        existingRoute.dropoff_location_label,
      departure_time:
        routeData.departure_time ?? existingRoute.departure_time,
    };

    const conflictingRoute = await this.repo.findRouteConflict({
      driverId,
      ...nextRouteValues,
      excludeRouteId: routeId,
    });

    if (conflictingRoute) {
      throw createServiceError("Route already exists", 400);
    }

    let updatedRoute: RouteRecord;
    try {
      updatedRoute = await db.transaction(async (tx) => {
        const record = await this.repo.updateRoute(tx, routeId, {
          ...routeData,
          updatedAt: new Date(),
        });

        await this.driverService.recordRouteStatusChange(tx, {
          driverId,
          previousStatus: existingRoute.status,
          nextStatus: record.status,
        });

        return record;
      });
    } catch (error) {
      if (isConstraintError(error, ROUTE_DUPLICATE_CONSTRAINT)) {
        throw createServiceError("Route already exists", 400);
      }
      throw error;
    }

    return this.buildRouteResponse(updatedRoute);
  }

  async deleteRoute(user: JWTPayload, routeId: string): Promise<void> {
    const driverId = await resolveDriverId(user);
    const existingRoute = await this.repo.findRouteById(routeId);

    if (!existingRoute) {
      throw createServiceError("Route not found", 404);
    }
    if (existingRoute.driverId !== driverId) {
      throw createServiceError(
        "You are not authorized to delete this route",
        403,
      );
    }

    const existingTrip = await this.repo.findTripByRouteId(routeId);

    if (existingTrip) {
      throw createServiceError(
        "Cannot delete route that has trips. Complete all trips first.",
        400,
      );
    }

    await db.transaction(async (tx) => {
      await this.repo.deleteRoute(tx, routeId);
      await this.driverService.recordRouteStatusChange(tx, {
        driverId: existingRoute.driverId,
        previousStatus: existingRoute.status,
        nextStatus: null,
      });
    });
  }

  private async buildRouteResponse(
    record: RouteRecord,
    remainingSeats = record.availableSeats,
    driverRecord?: DriverRecord | null,
  ): Promise<Route> {
    const routeDriverRecord =
      driverRecord ?? (await this.repo.findDriverById(record.driverId));

    if (!routeDriverRecord) {
      throw createServiceError("Driver not found", 404);
    }

    return {
      ...record,
      remainingSeats,
      driver: mapDriverToRouteDriver(routeDriverRecord),
    };
  }
}
