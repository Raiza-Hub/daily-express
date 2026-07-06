import "dotenv/config";
import { db } from "../db/connection";
import { trip } from "../db/index";
import { inArray, and, eq, sql, gte, lte, isNull } from "drizzle-orm";

const routes = await db.query.route.findMany({
  where: (r, opts) => opts.inArray(r.pickup_location_title, [
    "UNILAG Main Gate", "UI Main Gate", "OAU Campus Gate", "UNIBEN Ugbowo Gate",
    "UNN Nsukka Gate", "FUTA Main Gate", "ABU Main Gate", "UNILORIN Main Gate",
    "UNICAL Main Gate", "UNIUYO Main Gate"
  ])
});

const routeIds = routes.map(r => r.id);
console.log("Found routes:", routeIds.length);

const result = await db.delete(trip).where(
  and(
    inArray(trip.routeId, routeIds),
    gte(trip.date, new Date("2026-07-18")),
    lte(trip.date, new Date("2026-07-27")),
    eq(trip.status, "awaiting_driver"),
    isNull(trip.driverId),
    sql`NOT EXISTS (SELECT 1 FROM booking WHERE booking.trip_id = trip.id)`,
  )
);
console.log("Deleted trips:", result.length ?? JSON.stringify(result));
process.exit(0);
