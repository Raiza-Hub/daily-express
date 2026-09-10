import { createServiceError } from "@shared/utils";
import { and, eq, ilike } from "drizzle-orm";
import { db } from "../db/connection";
import { route, type RouteRecord } from "../db/index";

export class SearchService {
  async searchRoutes(params: { origin: string }): Promise<RouteRecord[]> {
    const origin = params.origin.trim();
    if (!origin) {
      throw createServiceError("origin is required", 400);
    }

    return db
      .select()
      .from(route)
      .where(
        and(
          eq(route.status, "active"),
          ilike(route.origin_title, `%${origin}%`),
        ),
      );
  }
}

export const searchService = new SearchService();