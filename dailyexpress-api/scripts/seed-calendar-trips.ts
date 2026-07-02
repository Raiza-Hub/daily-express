import "dotenv/config";
import { db } from "../db/connection";
import { route, trip } from "../db/index";
import { getRouteServiceTimeZone } from "../utils/timezone";

const ROUTE_DEFAULTS = [
  {
    pickup_location_title: "Lagos",
    pickup_location_locality: "Lagos Island",
    pickup_location_label: "Lagos Main Park",
    dropoff_location_title: "Ibadan",
    dropoff_location_locality: "Ibadan North",
    dropoff_location_label: "Ibadan Terminal",
    meeting_point: "Main Park Gate",
    priceCar: 5000,
    priceBus: 3000,
    departure_time: "08:00:00",
    arrival_time: "11:00:00",
    vehicleType: "bus",
    capacity: 14,
  },
  {
    pickup_location_title: "UI Main Gate",
    pickup_location_locality: "Ibadan North",
    pickup_location_label: "University of Ibadan Main Gate",
    dropoff_location_title: "Ojota",
    dropoff_location_locality: "Kosofe",
    dropoff_location_label: "Ojota Bus Stop",
    meeting_point: "Main Gate",
    priceCar: 7000,
    priceBus: 4500,
    departure_time: "09:30:00",
    arrival_time: "12:30:00",
    vehicleType: "bus",
    capacity: 14,
  },
  {
    pickup_location_title: "OOU University",
    pickup_location_locality: "Ago-Iwoye",
    pickup_location_label: "OOU Main Gate",
    dropoff_location_title: "Oshodi",
    dropoff_location_locality: "Oshodi-Isolo",
    dropoff_location_label: "Oshodi Terminal",
    meeting_point: "Main Gate",
    priceCar: 4000,
    priceBus: 2500,
    departure_time: "14:00:00",
    arrival_time: "16:00:00",
    vehicleType: "bus",
    capacity: 14,
  },
  {
    pickup_location_title: "Ikeja",
    pickup_location_locality: "Ikeja",
    pickup_location_label: "Ikeja Bus Terminal",
    dropoff_location_title: "Victoria Island",
    dropoff_location_locality: "Eti-Osa",
    dropoff_location_label: "VI Bus Stop",
    meeting_point: "Terminal Gate",
    priceCar: 3000,
    priceBus: 2000,
    departure_time: "07:00:00",
    arrival_time: "08:30:00",
    vehicleType: "car",
    capacity: 7,
  },
  {
    pickup_location_title: "Abeokuta",
    pickup_location_locality: "Abeokuta North",
    pickup_location_label: "Abeokuta Garage",
    dropoff_location_title: "Lagos",
    dropoff_location_locality: "Lagos Island",
    dropoff_location_label: "Lagos Main Park",
    meeting_point: "Garage Entrance",
    priceCar: 6000,
    priceBus: 3500,
    departure_time: "06:00:00",
    arrival_time: "09:00:00",
    vehicleType: "bus",
    capacity: 14,
  },
];

async function main() {
  const tz = getRouteServiceTimeZone();
  console.log(`Timezone: ${tz}`);

  // --- Create routes ---
  const routeIds: string[] = [];
  for (const r of ROUTE_DEFAULTS) {
    const [record] = await db
      .insert(route)
      .values({
        pickup_location_title: r.pickup_location_title,
        pickup_location_locality: r.pickup_location_locality,
        pickup_location_label: r.pickup_location_label,
        dropoff_location_title: r.dropoff_location_title,
        dropoff_location_locality: r.dropoff_location_locality,
        dropoff_location_label: r.dropoff_location_label,
        meeting_point: r.meeting_point,
        priceCar: r.priceCar,
        priceBus: r.priceBus,
        departure_time: r.departure_time,
        arrival_time: r.arrival_time,
        status: "active",
      })
      .returning();
    routeIds.push(record.id);
    console.log(
      `Route: ${r.pickup_location_title} → ${r.dropoff_location_title} @ ${r.departure_time} (${r.vehicleType}, ${r.capacity} seats)`,
    );
  }

  // --- Generate trips per day ---
  const today = new Date();
  const tripsToInsert: (typeof trip.$inferInsert)[] = [];
  let totalTrips = 0;

  for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
    const date = new Date(today);
    date.setDate(today.getDate() + dayOffset);
    date.setHours(0, 0, 0, 0);

    const tripsForDay = 20 + Math.floor(Math.random() * 11); // 20-30 trips

    for (let i = 0; i < tripsForDay; i++) {
      const ri = Math.floor(Math.random() * routeIds.length);
      const rDef = ROUTE_DEFAULTS[ri];
      const bookedSeats = Math.floor(Math.random() * 6); // 0-5

      // Spread departures across the day by adding random minutes to the base time
      const tripDate = new Date(date);
      tripDate.setMinutes(Math.floor(Math.random() * 1440)); // random minute of day
      tripDate.setSeconds(0);

      tripsToInsert.push({
        routeId: routeIds[ri],
        date: tripDate,
        vehicleType: rDef.vehicleType as "car" | "bus",
        capacity: rDef.capacity,
        bookedSeats,
        status: "awaiting_driver",
      });
      totalTrips++;
    }
  }

  // Insert in batches of 100 to avoid overwhelming the connection
  const BATCH_SIZE = 100;
  for (let i = 0; i < tripsToInsert.length; i += BATCH_SIZE) {
    const batch = tripsToInsert.slice(i, i + BATCH_SIZE);
    await db.insert(trip).values(batch);
    console.log(
      `Inserted trips ${i + 1}–${Math.min(i + BATCH_SIZE, tripsToInsert.length)} of ${tripsToInsert.length}`,
    );
  }

  // --- Summary by date ---
  const dateCounts: Record<string, number> = {};
  for (const t of tripsToInsert) {
    const d = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}-${String(t.date.getDate()).padStart(2, "0")}`;
    dateCounts[d] = (dateCounts[d] || 0) + 1;
  }

  console.log("\n=== Seed Summary ===");
  console.log(`Routes created: ${routeIds.length}`);
  console.log(`Total trips: ${totalTrips}`);
  console.log(`Date range: ${Object.keys(dateCounts).sort()[0]} → ${Object.keys(dateCounts).sort().at(-1)}`);
  console.log("\nTrips per date (first 10):");
  const sortedDates = Object.entries(dateCounts).sort(([a], [b]) => a.localeCompare(b));
  for (const [d, c] of sortedDates.slice(0, 10)) {
    console.log(`  ${d}: ${c} trips`);
  }
  console.log("...");
  console.log("Calendar seed data created successfully!");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
