import { createServiceError } from "@shared/utils";
import { and, asc, desc, eq, getTableColumns, gt, gte, inArray, lt, or, sql } from "drizzle-orm";
import { Route } from "shared/types";
import { db } from "../db/connection";
import { driver, route, trip } from "../db/index";
import {
    createNormalizedSearchScore,
    getBusinessDayWindow,
    mapDriverToRouteDriver,
    normalizeSearchText,
} from "../utils/route";
import {
    ALLOWED_VEHICLE_TYPES,
    ROUTE_SEARCH_SCORE_THRESHOLD,
    normalizePageLimit,
    decodeCursor,
    encodeCursor,
} from "./utils";

type VehicleType = (typeof ALLOWED_VEHICLE_TYPES)[number];
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
    vehicleType?: string[];
    limit?: number;
    cursor?: string;
  }): Promise<{ routes: Route[]; nextCursor: string | null }> {
    const { from, to, date, vehicleType, cursor } = params;
    const limit = normalizePageLimit(params.limit);
    const parsedFrom = from.trim();
    const parsedTo = to.trim();
    const normalizedFrom = parsedFrom ? normalizeSearchText(parsedFrom) : "";
    const normalizedTo = parsedTo ? normalizeSearchText(parsedTo) : "";
    const decodedCursor = decodeCursor(cursor, isRouteSearchCursor);
    const parsedVehicleType = vehicleType?.filter(
      (value): value is VehicleType =>
        ALLOWED_VEHICLE_TYPES.includes(value as VehicleType),
    );

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

    if (parsedVehicleType && parsedVehicleType.length > 0) {
      conditions.push(inArray(route.vehicleType, parsedVehicleType));
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

    const tripBookedSeats = db
      .select({
        routeId: trip.routeId,
        bookedSeats: sql<number>`coalesce(sum(${trip.bookedSeats}), 0)::int`.as(
          "booked_seats",
        ),
      })
      .from(trip)
      .where(and(gte(trip.date, start), lt(trip.date, end)))
      .groupBy(trip.routeId)
      .as("trip_booked_seats");
    const remainingSeats = sql<number>`greatest(${route.availableSeats} - coalesce(${tripBookedSeats.bookedSeats}, 0), 0)`;

    const routesResult = await db
      .select({
        route: getTableColumns(route),
        driver: getTableColumns(driver),
        pickupScore,
        dropoffScore,
        combinedScore,
        remainingSeats,
      })
      .from(route)
      .innerJoin(driver, eq(driver.id, route.driverId))
      .leftJoin(tripBookedSeats, eq(tripBookedSeats.routeId, route.id))
      .where(
        and(
          ...conditions,
          gte(pickupScore, ROUTE_SEARCH_SCORE_THRESHOLD),
          gte(dropoffScore, ROUTE_SEARCH_SCORE_THRESHOLD),
          sql`${remainingSeats} > 0`,
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
      route: {
        ...record.route,
        remainingSeats: record.remainingSeats,
        driver: mapDriverToRouteDriver(record.driver),
      },
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
