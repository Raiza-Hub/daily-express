import type { updateRouteRequest } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { db } from "../db/connection";
import { route } from "../db/index";
import { RouteRepository, routeRepository } from "./route.repository";
import type { RouteRecord } from "../db/index";

type RouteInsert = typeof route.$inferInsert;

export class RouteCrudService {
  constructor(private repo: RouteRepository) {}

  async createRoute(routeData: RouteInsert): Promise<RouteRecord> {
    const existingRoute = await this.repo.findRouteConflict({
      origin_title: routeData.origin_title,
      origin_locality: routeData.origin_locality,
      origin_label: routeData.origin_label,
    });

    if (existingRoute) {
      throw createServiceError("Route already exists", 400);
    }

    return db.transaction(async (tx) => {
      return this.repo.insertRoute(tx, routeData);
    });
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

    const originChanged =
      routeData.origin_title ?? routeData.origin_locality ?? routeData.origin_label;
    if (originChanged) {
      const conflictingRoute = await this.repo.findRouteConflict({
        origin_title:
          routeData.origin_title ?? existingRoute.origin_title,
        origin_locality:
          routeData.origin_locality ?? existingRoute.origin_locality,
        origin_label:
          routeData.origin_label ?? existingRoute.origin_label,
      });

      if (conflictingRoute) {
        throw createServiceError("Route already exists", 400);
      }
    }

    return db.transaction(async (tx) => {
      return this.repo.updateRoute(tx, routeId, {
        ...routeData,
        updatedAt: new Date(),
      });
    });
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
