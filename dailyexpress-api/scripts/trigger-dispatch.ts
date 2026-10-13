import "dotenv/config";
import { tripDispatchService } from "../dispatch/trip-dispatch.service";

const tripId = process.argv[2] ?? "c8c42c56-08b4-4309-a753-3761dbb946a1";
const action = (process.argv[3] ?? "advance") as "advance" | "guard";

console.log(`Triggering ${action} for trip`, tripId);
if (action === "guard") {
  await tripDispatchService.processJob({ action: "guard", tripId });
} else {
  await tripDispatchService.processJob({ action: "advance", tripId });
}
console.log(`${action} completed for trip`, tripId);
process.exit(0);
