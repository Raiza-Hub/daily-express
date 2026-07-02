import type { updateRouteRequest } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { db } from "../db/connection";
import { route } from "../db/index";
import { isConstraintError } from "../utils/route";
import { RouteRepository, routeRepository } from "./route.repository";
import type { RouteRecord } from "../db/index";

type RouteInsert = typeof route.$inferInsert;

export class RouteCrudService {
  constructor(private repo: RouteRepository) {}

  async createRoute(routeData: RouteInsert): Promise<RouteRecord> {
    const existingRoute = await this.repo.findRouteConflict({
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

    try {
      const newRoute = await db.transaction(async (tx) => {
        return this.repo.insertRoute(tx, routeData);
      });
      return newRoute;
    } catch (error) {
      if (isConstraintError(error, "route_origin_destination_departure_unique_idx")) {
        throw createServiceError("Route already exists", 400);
      }
      throw error;
    }
  }

  async getAllRoutes(): Promise<RouteRecord[]> {
    return this.repo.findAllRoutes();
  }

  async updateRoute(
    routeId: string,
    routeData: updateRouteRequest,
  ): Promise<RouteRecord> {
    const existingRoute = await this.repo.findRouteById(routeId);

    if (!existingRoute) {
      throw createServiceError("Route not found", 404);
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
      ...nextRouteValues,
      excludeRouteId: routeId,
    });

    if (conflictingRoute) {
      throw createServiceError("Route already exists", 400);
    }

    try {
      return await db.transaction(async (tx) => {
        return this.repo.updateRoute(tx, routeId, {
          ...routeData,
          updatedAt: new Date(),
        });
      });
    } catch (error) {
      if (isConstraintError(error, "route_origin_destination_departure_unique_idx")) {
        throw createServiceError("Route already exists", 400);
      }
      throw error;
    }
  }

  async deleteRoute(routeId: string): Promise<void> {
    const existingRoute = await this.repo.findRouteById(routeId);

    if (!existingRoute) {
      throw createServiceError("Route not found", 404);
    }

    await db.transaction(async (tx) => {
      await this.repo.updateRoute(tx, routeId, {
        status: "inactive",
        updatedAt: new Date(),
      });
    });
  }
}

export const routeCrudService = new RouteCrudService(routeRepository);
