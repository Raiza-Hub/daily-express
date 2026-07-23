import { createServiceError } from "@shared/utils";
import { and, asc, desc, eq, getTableColumns, gt, gte, lt, or, sql } from "drizzle-orm";
import { db } from "../db/connection";
import { route, zone } from "../db/index";
import {
    createNormalizedSearchScore,
    getBusinessDayWindow,
    normalizeSearchText,
} from "../utils/route";
import {
    ROUTE_SEARCH_SCORE_THRESHOLD,
    normalizePageLimit,
    decodeCursor,
    encodeCursor,
} from "./utils";

type RouteSearchCursor = {
  combinedScore: number;
  pickupScore: number;
  dropoffScore: number;
  createdAt: string;
  id: string;
};

function isRouteSearchCursor(value: unknown): value is RouteSearchCursor {
  if (!value || typeof value !== "object") return false;
  const cursor = value as Record<string, unknown>;
  return (
    typeof cursor.combinedScore === "number" &&
    typeof cursor.pickupScore === "number" &&
    typeof cursor.dropoffScore === "number" &&
    typeof cursor.createdAt === "string" &&
    !Number.isNaN(new Date(cursor.createdAt).getTime()) &&
    typeof cursor.id === "string"
  );
}

export class SearchService {
  async searchRoutes(params: {
    from: string;
    to: string;
    date: string;
    departureTime?: string;
    limit?: number;
    cursor?: string;
  }) {
    const { from, to, date, departureTime, cursor } = params;
    const limit = normalizePageLimit(params.limit);
    const parsedFrom = from.trim();
    const parsedTo = to.trim();
    const normalizedFrom = parsedFrom ? normalizeSearchText(parsedFrom) : "";
    const normalizedTo = parsedTo ? normalizeSearchText(parsedTo) : "";
    const decodedCursor = decodeCursor(cursor, isRouteSearchCursor);

    if (!parsedFrom || !parsedTo) {
      throw createServiceError("from and to are required", 400);
    }

    if (!date.trim()) {
      throw createServiceError("date is required", 400);
    }

    const { start, end } = getBusinessDayWindow(date);

    const pickupTitleScore = createNormalizedSearchScore(
      route.pickup_location_title,
      parsedFrom,
      normalizedFrom,
    );
    const pickupLabelScore = createNormalizedSearchScore(
      route.pickup_location_label,
      parsedFrom,
      normalizedFrom,
    );
    const pickupLocalityScore = createNormalizedSearchScore(
      route.pickup_location_locality,
      parsedFrom,
      normalizedFrom,
    );
    const dropoffTitleScore = createNormalizedSearchScore(
      route.dropoff_location_title,
      parsedTo,
      normalizedTo,
    );
    const dropoffLabelScore = createNormalizedSearchScore(
      route.dropoff_location_label,
      parsedTo,
      normalizedTo,
    );
    const dropoffLocalityScore = createNormalizedSearchScore(
      route.dropoff_location_locality,
      parsedTo,
      normalizedTo,
    );
    const pickupScore = sql<number>`greatest(
      ${pickupTitleScore},
      ${pickupLabelScore},
      ${pickupLocalityScore}
    )`;
    const dropoffScore = sql<number>`greatest(
      ${dropoffTitleScore},
      ${dropoffLabelScore},
      ${dropoffLocalityScore}
    )`;
    const combinedScore = sql<number>`${pickupScore} + ${dropoffScore}`;
    const conditions = [eq(route.status, "active")];

    const TIME_RANGES: Record<string, { start: string; end: string }> = {
      morning: { start: "00:00:00", end: "11:59:59" },
      afternoon: { start: "12:00:00", end: "23:59:59" },
    };

    if (departureTime) {
      const range = TIME_RANGES[departureTime];
      if (range) {
        conditions.push(
          sql`${route.departure_time}::time BETWEEN ${range.start}::time AND ${range.end}::time`,
        );
      }
    }

    if (decodedCursor) {
      const cursorCreatedAt = new Date(decodedCursor.createdAt);
      const cursorCondition = or(
        lt(combinedScore, decodedCursor.combinedScore),
        and(
          eq(combinedScore, decodedCursor.combinedScore),
          lt(pickupScore, decodedCursor.pickupScore),
        ),
        and(
          eq(combinedScore, decodedCursor.combinedScore),
          eq(pickupScore, decodedCursor.pickupScore),
          lt(dropoffScore, decodedCursor.dropoffScore),
        ),
        and(
          eq(combinedScore, decodedCursor.combinedScore),
          eq(pickupScore, decodedCursor.pickupScore),
          eq(dropoffScore, decodedCursor.dropoffScore),
          lt(route.createdAt, cursorCreatedAt),
        ),
        and(
          eq(combinedScore, decodedCursor.combinedScore),
          eq(pickupScore, decodedCursor.pickupScore),
          eq(dropoffScore, decodedCursor.dropoffScore),
          eq(route.createdAt, cursorCreatedAt),
          gt(route.id, decodedCursor.id),
        ),
      );

      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const routeColumns = getTableColumns(route);
    const zoneColumns = getTableColumns(zone);

    const routesResult = await db
      .select({
        route: routeColumns,
        zone: zoneColumns,
        pickupScore,
        dropoffScore,
        combinedScore,
      })
      .from(route)
      .leftJoin(zone, eq(route.zoneId, zone.id))
      .where(
        and(
          ...conditions,
          gte(pickupScore, ROUTE_SEARCH_SCORE_THRESHOLD),
          gte(dropoffScore, ROUTE_SEARCH_SCORE_THRESHOLD),
        ),
      )
      .orderBy(
        desc(combinedScore),
        desc(pickupScore),
        desc(dropoffScore),
        desc(route.createdAt),
        asc(route.id),
      )
      .limit(limit + 1);

    if (routesResult.length === 0) {
      return { routes: [], nextCursor: null };
    }

    const visibleRoutes = routesResult.map((record) => ({
      route: { ...record.route, zone: record.zone },
      cursor: {
        combinedScore: record.combinedScore,
        pickupScore: record.pickupScore,
        dropoffScore: record.dropoffScore,
        createdAt: record.route.createdAt.toISOString(),
        id: record.route.id,
      },
    }));

    const pageRoutes = visibleRoutes.slice(0, limit);
    const nextVisibleRoute = visibleRoutes[limit];
    const lastRoute = pageRoutes[pageRoutes.length - 1];

    return {
      routes: pageRoutes.map((record) => record.route),
      nextCursor:
        nextVisibleRoute && lastRoute ? encodeCursor(lastRoute.cursor) : null,
    };
  }
}

export const searchService = new SearchService();
